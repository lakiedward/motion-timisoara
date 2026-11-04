import { assert, assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  adminRefundHandler,
  type AdminRefundServices,
  parseRefundRequest,
  RefundRpcError,
  type RefundRow,
  stripeRefundStatus,
} from "./handler.ts";

const PAYMENT_ID = "00000000-0000-4000-8000-0000000000f1";

function refundRow(overrides: Partial<RefundRow> = {}): RefundRow {
  return {
    id: "00000000-0000-4000-8000-00000000aaaa",
    payment_id: PAYMENT_ID,
    subscription_invoice_id: null,
    method: "CARD",
    amount: 12000,
    status: "pending",
    reverse_transfer: true,
    ...overrides,
  };
}

function setup(overrides: Partial<AdminRefundServices> = {}) {
  const calls = { begin: [] as unknown[], settle: [] as unknown[][], stripe: [] as unknown[][] };
  const services: AdminRefundServices = {
    getUser: () => Promise.resolve({ id: "admin" }),
    getUserRole: () => Promise.resolve("ADMIN"),
    beginRefund: (request, adminId) => {
      calls.begin.push({ request, adminId });
      return Promise.resolve(refundRow({ amount: request.amount }));
    },
    settleRefund: (...args) => {
      calls.settle.push(args);
      return Promise.resolve();
    },
    paymentIntentFor: () => Promise.resolve("pi_test_1"),
    createStripeRefund: (...args) => {
      calls.stripe.push(args);
      return Promise.resolve({ id: "re_test_1", status: "succeeded", failure_reason: null });
    },
    ...overrides,
  };
  return { calls, handler: adminRefundHandler(services) };
}

function post(body: unknown) {
  return new Request("http://localhost/admin-refund-payment", { method: "POST", body: JSON.stringify(body) });
}

const VALID = { source: "PAYMENT", id: PAYMENT_ID, amount: 12000, reason: "  Ședință ratată  ", cancelEnrollment: true };

Deno.test("parseRefundRequest validates the source, id, amount and reason", () => {
  assertEquals(parseRefundRequest(null), "Cererea nu este validă.");
  assertEquals(parseRefundRequest({ ...VALID, source: "OTHER" }), "Alege plata de rambursat.");
  assertEquals(parseRefundRequest({ ...VALID, id: "x" }), "Plata nu este validă.");
  assertEquals(parseRefundRequest({ ...VALID, amount: 12.5 }), "Suma de rambursat nu este validă.");
  assertEquals(parseRefundRequest({ ...VALID, amount: 0 }), "Suma de rambursat nu este validă.");
  assertEquals(parseRefundRequest({ ...VALID, reason: " a " }), "Motivul trebuie să aibă între 3 și 500 de caractere.");
  assertEquals(parseRefundRequest(VALID), {
    source: "PAYMENT", id: PAYMENT_ID, amount: 12000, reason: "Ședință ratată", cancelEnrollment: true,
  });
  assertEquals((parseRefundRequest({ ...VALID, cancelEnrollment: "yes" }) as { cancelEnrollment: boolean }).cancelEnrollment, false);
});

Deno.test("stripeRefundStatus keeps known statuses and treats others as pending", () => {
  assertEquals(stripeRefundStatus("succeeded"), "succeeded");
  assertEquals(stripeRefundStatus("requires_action"), "requires_action");
  assertEquals(stripeRefundStatus("weird"), "pending");
  assertEquals(stripeRefundStatus(null), "pending");
});

Deno.test("only a live ADMIN role may refund", async () => {
  const { calls, handler } = setup({ getUserRole: () => Promise.resolve("COACH") });
  const response = await handler(post(VALID));
  assertEquals(response.status, 403);
  assertEquals(calls.begin.length, 0);
  assertEquals((await setup().handler(new Request("http://localhost", { method: "GET" }))).status, 405);
});

Deno.test("a card refund reverses the transfer, keeps the application fee and settles the outcome", async () => {
  const { calls, handler } = setup();
  const response = await handler(post(VALID));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { refundId: "00000000-0000-4000-8000-00000000aaaa", status: "succeeded" });
  assertEquals(calls.begin, [{
    request: { source: "PAYMENT", id: PAYMENT_ID, amount: 12000, reason: "Ședință ratată", cancelEnrollment: true },
    adminId: "admin",
  }]);
  assertEquals(calls.stripe, [[{
    payment_intent: "pi_test_1",
    amount: 12000,
    reverse_transfer: true,
    refund_application_fee: false,
    metadata: { refund_row_id: "00000000-0000-4000-8000-00000000aaaa", source: "PAYMENT", source_id: PAYMENT_ID },
  }, "admin-refund-00000000-0000-4000-8000-00000000aaaa"]]);
  assertEquals(calls.settle, [["00000000-0000-4000-8000-00000000aaaa", "re_test_1", "succeeded", null]]);
});

Deno.test("a platform charge refund does not ask Stripe to reverse a transfer", async () => {
  const { calls, handler } = setup({
    beginRefund: () => Promise.resolve(refundRow({ payment_id: null, subscription_invoice_id: "inv", reverse_transfer: false })),
  });
  await handler(post({ ...VALID, source: "SUBSCRIPTION_INVOICE" }));
  const params = calls.stripe[0][0] as Record<string, unknown>;
  assert(!("reverse_transfer" in params) && !("refund_application_fee" in params));
});

Deno.test("a cash refund is recorded without Stripe", async () => {
  const { calls, handler } = setup({
    beginRefund: () => Promise.resolve(refundRow({ method: "CASH", status: "succeeded", reverse_transfer: false })),
  });
  const response = await handler(post(VALID));
  assertEquals(response.status, 200);
  assertEquals((await response.json()).status, "succeeded");
  assertEquals(calls.stripe.length, 0);
  assertEquals(calls.settle.length, 0);
});

Deno.test("database refusals keep their meaning", async () => {
  const cases: [string, number][] = [["22023", 400], ["42501", 403], ["P0002", 404], ["XX000", 503]];
  for (const [code, status] of cases) {
    const { calls, handler } = setup({
      beginRefund: () => Promise.reject(new RefundRpcError("Suma depășește cât se mai poate rambursa (100 bani)", code)),
    });
    const response = await handler(post(VALID));
    assertEquals(response.status, status, code);
    if (code === "22023") assertEquals((await response.json()).error, "Suma depășește cât se mai poate rambursa (100 bani)");
    assertEquals(calls.stripe.length, 0);
  }
});

Deno.test("a Stripe failure marks the refund failed", async () => {
  const { calls, handler } = setup({ createStripeRefund: () => Promise.reject(new Error("Charge already refunded")) });
  const response = await handler(post(VALID));
  assertEquals(response.status, 502);
  assertEquals(calls.settle, [["00000000-0000-4000-8000-00000000aaaa", null, "failed", "Charge already refunded"]]);
});

Deno.test("a payment without a Stripe reference is refused after the refund is marked failed", async () => {
  const { calls, handler } = setup({ paymentIntentFor: () => Promise.resolve(null) });
  const response = await handler(post(VALID));
  assertEquals(response.status, 409);
  assertEquals(calls.stripe.length, 0);
  assertEquals(calls.settle[0][2], "failed");
});

Deno.test("a pending Stripe refund stays pending until the webhook settles it", async () => {
  const { calls, handler } = setup({
    createStripeRefund: () => Promise.resolve({ id: "re_test_2", status: "pending" }),
  });
  const response = await handler(post(VALID));
  assertEquals((await response.json()).status, "pending");
  assertEquals(calls.settle[0], ["00000000-0000-4000-8000-00000000aaaa", "re_test_2", "pending", null]);
});
