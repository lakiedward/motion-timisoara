import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import { type CheckoutLine, prepareCheckoutSession } from "./checkout-session.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function rejects(promise: Promise<unknown>, status: number) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Response) return equal(error.status, status);
    throw error;
  }
  throw new Error(`Expected a ${status} refusal`);
}

type Item = { price_data?: { unit_amount?: number; product_data?: { name?: string } } };

const items = (params: Stripe.Checkout.SessionCreateParams) => params.line_items as Item[];

function line(id: string, overrides: Partial<CheckoutLine> = {}): CheckoutLine {
  return {
    paymentId: `payment-${id}`,
    enrollmentId: `enrollment-${id}`,
    amount: 40000,
    status: "PENDING",
    gatewayId: null,
    name: `Înot · Copil ${id}`,
    ...overrides,
  };
}

function fixture(rows: CheckoutLine[]) {
  const saved = new Map(rows.map((row) => [row.paymentId, { ...row }]));
  const creates: { params: Stripe.Checkout.SessionCreateParams; key: string }[] = [];
  const expired: string[] = [];
  const canceled: string[] = [];
  const sessions = new Map<string, Partial<Stripe.Checkout.Session>>();
  const intents = new Map<string, Partial<Stripe.PaymentIntent>>();
  let failSave = false;
  const db = {
    from(table: string) {
      equal(table, "payments");
      let patch: Record<string, unknown> = {};
      const filters: [string, unknown][] = [];
      return {
        update(values: Record<string, unknown>) { patch = values; return this; },
        eq(key: string, value: unknown) { filters.push([key, value]); return this; },
        is(key: string, value: unknown) { filters.push([key, value]); return this; },
        select() { return this; },
        single() {
          const id = filters.find(([key]) => key === "id")?.[1] as string;
          const row = saved.get(id)!;
          const current: Record<string, unknown> = {
            id: row.paymentId, method: "CARD", status: row.status, amount: row.amount,
            currency: "RON", gateway_txn_id: row.gatewayId,
          };
          const matched = !failSave && filters.every(([key, value]) => current[key] === value);
          if (matched) row.gatewayId = patch.gateway_txn_id as string;
          return Promise.resolve(matched ? { data: { id }, error: null } : { data: null, error: { message: "changed" } });
        },
      };
    },
  } as unknown as SupabaseClient;
  const stripe = {
    checkout: {
      sessions: {
        create: (params: Stripe.Checkout.SessionCreateParams, options: { idempotencyKey: string }) => {
          creates.push({ params, key: options.idempotencyKey });
          const session = {
            id: `cs_${creates.length}`,
            url: `https://checkout.stripe.com/c/${creates.length}`,
            status: "open",
            currency: "ron",
            amount_total: items(params).reduce((sum, item) => sum + (item.price_data!.unit_amount ?? 0), 0),
            metadata: params.metadata,
          };
          sessions.set(session.id, session as Partial<Stripe.Checkout.Session>);
          return Promise.resolve(session);
        },
        retrieve: (id: string) => Promise.resolve(sessions.get(id)),
        expire: (id: string) => {
          expired.push(id);
          sessions.set(id, { ...sessions.get(id), status: "expired" });
          return Promise.resolve(sessions.get(id));
        },
      },
    },
    paymentIntents: {
      retrieve: (id: string) => Promise.resolve(intents.get(id)),
      cancel: (id: string) => { canceled.push(id); return Promise.resolve({}); },
    },
  } as unknown as Pick<Stripe, "checkout" | "paymentIntents">;
  const order = (lines = rows, destination: string | null = "acct_club") => ({
    lines, destination, customerEmail: "parinte@example.test", returnBase: "https://master--motiontimisoara.netlify.app",
  });
  return {
    db, stripe, saved, creates, expired, canceled, sessions, intents, order,
    failSave: () => { failSave = true; },
  };
}

Deno.test("one Romanian Checkout Session covers every child with one line each and the summed fee", async () => {
  const f = fixture([line("a"), line("b", { amount: 30000 })]);
  const result = await prepareCheckoutSession(f.db, f.stripe, f.order(), 0);
  equal(result, { url: "https://checkout.stripe.com/c/1" });
  const params = f.creates[0].params;
  equal(params.locale, "ro");
  equal(items(params).map((item) => [item.price_data!.product_data!.name, item.price_data!.unit_amount]), [
    ["Înot · Copil a", 40000],
    ["Înot · Copil b", 30000],
  ]);
  equal(params.metadata, { paymentIds: "payment-a,payment-b" });
  equal(params.payment_intent_data!.metadata, { paymentIds: "payment-a,payment-b" });
  equal(params.payment_intent_data!.transfer_data, { destination: "acct_club" });
  equal(params.payment_intent_data!.application_fee_amount, 1785 + 1369);
  equal(params.success_url, "https://master--motiontimisoara.netlify.app/account/plata?rezultat=reusita&inscrieri=enrollment-a,enrollment-b");
  equal(params.cancel_url, "https://master--motiontimisoara.netlify.app/account/plata?rezultat=anulata&inscrieri=enrollment-a,enrollment-b");
  equal([...f.saved.values()].map((row) => row.gatewayId), ["cs_1", "cs_1"]);
});

Deno.test("a platform payment carries no transfer or application fee", async () => {
  const f = fixture([line("a")]);
  await prepareCheckoutSession(f.db, f.stripe, f.order(undefined, null), 0);
  equal(f.creates[0].params.payment_intent_data!.transfer_data, undefined);
  equal(f.creates[0].params.payment_intent_data!.application_fee_amount, undefined);
});

Deno.test("an open session for the same order is reused instead of creating a second charge", async () => {
  const f = fixture([line("a")]);
  await prepareCheckoutSession(f.db, f.stripe, f.order(), 0);
  const resumed = [...f.saved.values()];
  const result = await prepareCheckoutSession(f.db, f.stripe, f.order(resumed), 0);
  equal(result, { url: "https://checkout.stripe.com/c/1" });
  equal(f.creates.length, 1);
});

Deno.test("an open session for a different order is expired before a new one", async () => {
  const f = fixture([line("a"), line("b")]);
  await prepareCheckoutSession(f.db, f.stripe, f.order(), 0);
  const [first] = [...f.saved.values()];
  await prepareCheckoutSession(f.db, f.stripe, f.order([first]), 0);
  equal(f.expired, ["cs_1"]);
  equal(f.creates.length, 2);
  equal(f.saved.get("payment-a")!.gatewayId, "cs_2");
});

Deno.test("a completed session or a processing intent refuses a new payment", async () => {
  const f = fixture([line("a")]);
  await prepareCheckoutSession(f.db, f.stripe, f.order(), 0);
  f.sessions.set("cs_1", { ...f.sessions.get("cs_1"), status: "complete" });
  await rejects(prepareCheckoutSession(f.db, f.stripe, f.order([...f.saved.values()]), 0), 409);
  const g = fixture([line("a", { gatewayId: "pi_old" })]);
  g.intents.set("pi_old", { id: "pi_old", status: "processing" });
  await rejects(prepareCheckoutSession(g.db, g.stripe, g.order(), 0), 409);
  equal(g.creates.length, 0);
});

Deno.test("an unconfirmed card intent from the old flow is canceled first", async () => {
  const f = fixture([line("a", { gatewayId: "pi_old" })]);
  f.intents.set("pi_old", { id: "pi_old", status: "requires_payment_method" });
  await prepareCheckoutSession(f.db, f.stripe, f.order(), 0);
  equal(f.canceled, ["pi_old"]);
  equal(f.saved.get("payment-a")!.gatewayId, "cs_1");
});

Deno.test("a lost save expires the new session and refuses", async () => {
  const f = fixture([line("a")]);
  f.failSave();
  await rejects(prepareCheckoutSession(f.db, f.stripe, f.order(), 0), 409);
  equal(f.expired, ["cs_1"]);
});

Deno.test("paid orders need no session and oversize or non-pending orders are refused", async () => {
  const f = fixture([line("a", { status: "SUCCEEDED", gatewayId: "cs_paid" })]);
  equal(await prepareCheckoutSession(f.db, f.stripe, f.order(), 0), { alreadyPaid: true });
  const many = Array.from({ length: 11 }, (_, index) => line(String(index)));
  const g = fixture(many);
  await rejects(prepareCheckoutSession(g.db, g.stripe, g.order(), 0), 400);
  const h = fixture([line("a", { status: "REFUNDED" })]);
  await rejects(prepareCheckoutSession(h.db, h.stripe, h.order(), 0), 409);
  equal(g.creates.length + h.creates.length, 0);
});
