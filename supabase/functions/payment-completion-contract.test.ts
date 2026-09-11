import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import { cashPaymentHandler } from "./mark-cash-paid/handler.ts";
import { paymentWebhookHandler } from "./stripe-webhook/handler.ts";
import { withCors } from "./_shared/cors.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function database(kind = "COURSE", role = "COACH", own = true) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const payment = { id: "payment", amount: 50000, currency: "RON", method: "CASH", enrollment: { kind, entity_id: "offer" } };
  const rows: Record<string, Record<string, unknown> | null> = {
    payments: payment,
    courses: { coach_id: own ? "actor" : "foreign", club_id: "club" },
    activities: { coach_id: own ? "actor" : "foreign", club_id: "club" },
    camps: { coach_id: own ? "actor" : "foreign", club_id: "club" },
    clubs: { owner_user_id: own ? "actor" : "foreign" },
    enrollments: null,
  };
  let failedTable: string | null = null;
  let rpcError = false;
  const client = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      return {
        select() { return this; },
        eq(column: string, value: unknown) { filters.push([column, value]); return this; },
        single() {
          const expected = table === "payments" ? "payment" : table === "clubs" ? "club" : "offer";
          if (table !== "enrollments") equal(filters, [["id", expected]]);
          return Promise.resolve({ data: failedTable === table ? null : rows[table], error: failedTable === table ? { message: "offline" } : null });
        },
      };
    },
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return Promise.resolve({ data: rpcError ? null : { changed: false, status: "SUCCEEDED", enrollmentId: "enrollment", sessionsAdded: 0 }, error: rpcError ? { message: "offline" } : null });
    },
  };
  return {
    db: client as unknown as SupabaseClient, calls, payment,
    getUser: () => Promise.resolve({ id: "actor" }),
    getUserRole: () => Promise.resolve(role),
    failTable: (table: string) => { failedTable = table; },
    failRpc: () => { rpcError = true; },
  };
}

const cashRequest = () => new Request("http://local/mark-cash-paid", {
  method: "POST", body: JSON.stringify({ paymentId: "payment" }),
});

for (const role of ["COACH", "CLUB", "ADMIN"]) {
  for (const kind of ["COURSE", "ACTIVITY", "CAMP"]) {
    Deno.test(`cash confirmation: ${role} can confirm owned ${kind} without reading current price`, async () => {
      const services = database(kind, role);
      const response = await cashPaymentHandler(services)(cashRequest());
      equal(response.status, 200);
      equal(services.calls, [{ name: "apply_enrollment_payment_result", args: {
        p_payment_id: "payment", p_result: "SUCCEEDED", p_amount: 50000, p_currency: "RON", p_method: "CASH", p_gateway_id: null,
      } }]);
    });
    if (role !== "ADMIN") Deno.test(`cash confirmation: ${role} cannot confirm foreign ${kind}`, async () => {
      const services = database(kind, role, false);
      equal((await cashPaymentHandler(services)(cashRequest())).status, 403);
      equal(services.calls.length, 0);
    });
  }
}

Deno.test("parent cannot use cash confirmation", async () => {
  const services = database("COURSE", "PARENT");
  equal((await cashPaymentHandler(services)(cashRequest())).status, 403);
  equal(services.calls.length, 0);
});

Deno.test("cash endpoint refuses card payments and ownership read failures", async () => {
  const services = database();
  services.payment.method = "CARD";
  equal((await cashPaymentHandler(services)(cashRequest())).status, 400);
  services.payment.method = "CASH";
  services.failTable("courses");
  equal((await cashPaymentHandler(services)(cashRequest())).status, 503);
  equal(services.calls.length, 0);
});

Deno.test("cash confirmation cannot return success after transaction failure", async () => {
  const services = database();
  services.failRpc();
  const response = await withCors(cashPaymentHandler(services))(cashRequest());
  equal(response.status, 500);
});

function webhook(db: SupabaseClient, type = "payment_intent.succeeded", receivedAmount = 50000) {
  let verified = 0;
  const handler = paymentWebhookHandler({ db,
    verifyEvent: async (body, signature) => {
      equal(body, "raw-event");
      verified++;
      if (signature !== "valid") throw new Error("Invalid signature");
      return { type, data: { object: { id: "pi_accepted", metadata: { paymentId: "payment" },
        amount: 50000, amount_received: receivedAmount, currency: "ron" } } } as unknown as Stripe.Event;
    },
  });
  return { handler, verified: () => verified };
}

const webhookRequest = (signature?: string) => new Request("http://local/stripe-webhook", {
  method: "POST", body: "raw-event", headers: signature ? { "stripe-signature": signature } : {},
});

Deno.test("webhook verifies the raw signature before touching payment state", async () => {
  const services = database();
  const receiver = webhook(services.db);
  equal((await receiver.handler(webhookRequest())).status, 400);
  equal(receiver.verified(), 0);
  equal((await receiver.handler(webhookRequest("invalid"))).status, 400);
  equal(receiver.verified(), 1);
  equal(services.calls.length, 0);
});

for (const [type, outcome] of [["payment_intent.succeeded", "SUCCEEDED"], ["payment_intent.payment_failed", "FAILED"]]) {
  Deno.test(`webhook delegates ${outcome} atomically with the exact gateway charge`, async () => {
    const services = database();
    const receiver = webhook(services.db, type);
    equal((await receiver.handler(webhookRequest("valid"))).status, 200);
    equal(services.calls, [{ name: "apply_enrollment_payment_result", args: {
      p_payment_id: "payment", p_result: outcome, p_amount: 50000, p_currency: "RON", p_method: "CARD", p_gateway_id: "pi_accepted",
    } }]);
  });
}

Deno.test("webhook does not acknowledge a failed transaction", async () => {
  const services = database();
  services.failRpc();
  equal((await webhook(services.db).handler(webhookRequest("valid"))).status, 500);
});

Deno.test("webhook refuses a partial received amount and ignores unrelated events", async () => {
  const services = database();
  equal((await webhook(services.db, "payment_intent.succeeded", 49999).handler(webhookRequest("valid"))).status, 409);
  equal((await webhook(services.db, "customer.created").handler(webhookRequest("valid"))).status, 200);
  equal(services.calls.length, 0);
});
