import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import { preparePaymentIntent } from "./payment-intent.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function fixture(gateway: string | null = "pi_saved") {
  const payment = { id: "payment", enrollment_id: "enrollment", amount: 50000, currency: "RON", status: "PENDING", gateway_txn_id: gateway };
  const params: Stripe.PaymentIntentCreateParams = { amount: 50000, currency: "ron", metadata: { paymentId: "payment", enrollmentId: "enrollment" } };
  const intent = { id: "pi_saved", amount: 50000, currency: "ron", metadata: params.metadata,
    client_secret: "test-secret", status: "requires_payment_method" };
  const row: Record<string, unknown> = { ...payment, method: "CARD" };
  const creates: { key: string; params: unknown }[] = [];
  let retrieveFails = false;
  let createFails = false;
  let saveFails = false;
  let saves = 0;
  let frozenParams: Stripe.PaymentIntentCreateParams | null = null;
  let freezeFails = false;
  const db = {
    rpc(name: string, input: { p_payment_id: string; p_params: Stripe.PaymentIntentCreateParams }) {
      equal(name, "freeze_payment_intent_request");
      equal(input.p_payment_id, payment.id);
      if (freezeFails) return Promise.resolve({ data: null, error: { message: "request unavailable" } });
      frozenParams ??= structuredClone(input.p_params);
      return Promise.resolve({ data: structuredClone(frozenParams), error: null });
    },
    from(table: string) {
      equal(table, "payments");
      let patch: Record<string, unknown>;
      const filters: [string, unknown][] = [];
      return {
        update(values: Record<string, unknown>) { patch = values; return this; },
        eq(key: string, value: unknown) { filters.push([key, value]); return this; },
        is(key: string, value: unknown) { return this.eq(key, value); },
        select() { return this; },
        single() {
          saves++;
          const matched = !saveFails && filters.every(([key, value]) => row[key] === value);
          if (matched) Object.assign(row, patch);
          return Promise.resolve({ data: matched ? { id: row.id } : null, error: matched ? null : { message: "write failed" } });
        },
      };
    },
  } as unknown as SupabaseClient;
  const stripe = { paymentIntents: {
    retrieve: () => {
      if (retrieveFails) throw new Error("network unavailable");
      return Promise.resolve(intent);
    },
    create: (values: unknown, options: { idempotencyKey: string }) => {
      creates.push({ key: options.idempotencyKey, params: values });
      if (createFails) throw new Error("uncertain create response");
      return Promise.resolve(intent);
    },
  } } as unknown as Pick<Stripe, "paymentIntents">;
  return { payment, params, intent, row, creates,
    run: () => preparePaymentIntent(db, stripe, payment, params), saves: () => saves,
    failRetrieve: () => { retrieveFails = true; }, failCreate: (value = true) => { createFails = value; }, failSave: (value = true) => { saveFails = value; },
    failFreeze: () => { freezeFails = true; },
  };
}

async function rejected(run: () => Promise<unknown>, status: number) {
  try {
    await run();
    throw new Error("Unexpected success");
  } catch (error) {
    if (!(error instanceof Response)) throw error;
    equal(error.status, status);
  }
}

for (const state of ["requires_payment_method", "requires_confirmation", "requires_action"]) {
  Deno.test(`intent retry reuses ${state} without creating or cancelling a charge`, async () => {
    const f = fixture();
    f.intent.status = state;
    equal(await f.run(), { clientSecret: "test-secret" });
    equal(f.creates.length, 0);
    equal(f.saves(), 0);
  });
}
for (const state of ["processing", "requires_capture", "canceled"]) {
  Deno.test(`intent retry refuses ${state} without creating a charge`, async () => {
    const f = fixture();
    f.intent.status = state;
    await rejected(f.run, 409);
    equal(f.creates.length, 0);
  });
}
Deno.test("paid Stripe intent returns already succeeded", async () => {
  const f = fixture();
  f.intent.status = "succeeded";
  equal(await f.run(), { clientSecret: "test-secret", alreadySucceeded: true });
  equal(f.creates.length, 0);
});
Deno.test("uncertain gateway read never creates a replacement", async () => {
  const f = fixture();
  f.failRetrieve();
  await rejected(f.run, 503);
  equal(f.creates.length, 0);
});
Deno.test("saved intent must match amount, currency and identity", async () => {
  for (const patch of [{ amount: 49999 }, { currency: "eur" }, { metadata: { paymentId: "foreign", enrollmentId: "enrollment" } }]) {
    const f = fixture();
    Object.assign(f.intent, patch);
    await rejected(f.run, 409);
    equal(f.creates.length, 0);
  }
});
Deno.test("initial intent uses stable idempotency and persists before exposing its secret", async () => {
  const f = fixture(null);
  equal(await f.run(), { clientSecret: "test-secret" });
  equal(f.creates, [{ key: "enrollment-payment-payment", params: f.params }]);
  equal(f.row.gateway_txn_id, "pi_saved");
  equal(f.row.client_secret, "test-secret");
});
Deno.test("uncertain creation never returns an unsaved secret", async () => {
  const f = fixture(null);
  f.failCreate();
  await rejected(f.run, 503);
  equal(f.saves(), 0);
  equal(f.row.gateway_txn_id, null);
});
Deno.test("persistence failure and concurrent payment state changes never expose a secret", async () => {
  for (const change of ["storage", "paid", "method", "amount"]) {
    const f = fixture(null);
    if (change === "storage") f.failSave();
    if (change === "paid") f.row.status = "SUCCEEDED";
    if (change === "method") f.row.method = "CASH";
    if (change === "amount") f.row.amount = 100;
    await rejected(f.run, 409);
    equal(f.row.gateway_txn_id, null);
  }
});
Deno.test("concurrent preparations share the same Stripe idempotency key and one database binding", async () => {
  const f = fixture(null);
  const outcomes = await Promise.allSettled([f.run(), f.run()]);
  equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  equal(outcomes.filter((result) => result.status === "rejected").length, 1);
  equal(f.creates.map((call) => call.key), ["enrollment-payment-payment", "enrollment-payment-payment"]);
  equal(f.row.gateway_txn_id, "pi_saved");
});

for (const failure of ["response", "binding"]) {
  Deno.test(`uncertain Stripe ${failure} preserves original email, routing and fee across retry`, async () => {
    const f = fixture(null);
    Object.assign(f.params, { receipt_email: "first@example.test", transfer_data: { destination: "acct_first" }, application_fee_amount: 1000 });
    if (failure === "response") f.failCreate();
    else f.failSave();
    await rejected(f.run, failure === "response" ? 503 : 409);
    Object.assign(f.params, { receipt_email: "changed@example.test", transfer_data: { destination: "acct_changed" }, application_fee_amount: 2000 });
    f.failCreate(false);
    f.failSave(false);
    equal(await f.run(), { clientSecret: "test-secret" });
    equal(f.creates[0], f.creates[1]);
    equal(f.row.platform_fee_amount, 1000);
    equal(f.row.coach_payout_amount, 49000);
  });
}
Deno.test("request persistence failure never contacts Stripe", async () => {
  const f = fixture(null);
  f.failFreeze();
  await rejected(f.run, 409);
  equal(f.creates.length, 0);
});
