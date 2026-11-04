import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PAYMENT_WEBHOOK_EVENTS, paymentWebhookHandler, type RefundOutcome } from "./handler.ts";

function refund(id: string, overrides: Partial<Stripe.Refund> = {}): Stripe.Refund {
  return {
    id,
    object: "refund",
    amount: 12000,
    currency: "ron",
    status: "succeeded",
    payment_intent: "pi_checkout",
    metadata: {},
    ...overrides,
  } as Stripe.Refund;
}

function setup(event: Partial<Stripe.Event>, options: { fail?: boolean } = {}) {
  const recorded: [string, string | null][] = [];
  const listed: string[] = [];
  const handler = paymentWebhookHandler({
    db: {} as SupabaseClient,
    verifyEvent: () => Promise.resolve(event as Stripe.Event),
    sessionForIntent: (id) => Promise.resolve(id === "pi_checkout" ? "cs_test_1" : null),
    settleFee: () => Promise.resolve("not_applicable"),
    refundsOfCharge: (charge) => {
      listed.push(charge.id);
      return Promise.resolve([refund("re_1"), refund("re_2", { payment_intent: "pi_other", amount: 500 })]);
    },
    recordRefund: (item, sessionId): Promise<RefundOutcome> => {
      if (options.fail) return Promise.reject(new Error("db down"));
      recorded.push([item.id, sessionId]);
      return Promise.resolve(item.id === "re_2" ? "unknown" : "created");
    },
  });
  const request = new Request("http://localhost", { method: "POST", headers: { "stripe-signature": "sig" }, body: "{}" });
  return { recorded, listed, response: handler(request) };
}

Deno.test("the payments endpoint subscribes to the refund events", () => {
  assertEquals([...PAYMENT_WEBHOOK_EVENTS], [
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "charge.refunded",
    "charge.refund.updated",
  ]);
});

Deno.test("charge.refunded records every refund of the charge with its checkout session", async () => {
  const { recorded, listed, response } = setup({
    type: "charge.refunded",
    data: { object: { id: "ch_1", object: "charge" } as Stripe.Charge },
  } as Partial<Stripe.Event>);
  const result = await response;
  assertEquals(result.status, 200);
  assertEquals(await result.json(), { received: true, type: "charge.refunded", refunds: ["created", "unknown"] });
  assertEquals(listed, ["ch_1"]);
  assertEquals(recorded, [["re_1", "cs_test_1"], ["re_2", null]]);
});

Deno.test("charge.refund.updated records the refund in the event", async () => {
  const { recorded, response } = setup({
    type: "charge.refund.updated",
    data: { object: refund("re_9", { status: "failed", metadata: { refund_row_id: "row" } }) },
  } as Partial<Stripe.Event>);
  assertEquals((await response).status, 200);
  assertEquals(recorded, [["re_9", "cs_test_1"]]);
});

Deno.test("a refund that cannot be stored asks Stripe to retry", async () => {
  const { response } = setup({
    type: "charge.refund.updated",
    data: { object: refund("re_9") },
  } as Partial<Stripe.Event>, { fail: true });
  assertEquals((await response).status, 500);
});
