import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import { invoiceStatus, subscriptionInvoiceRow } from "./subscription-invoice.ts";

function invoice(overrides: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    id: "in_1",
    object: "invoice",
    amount_paid: 34900,
    amount_due: 34900,
    currency: "ron",
    customer_name: "Club Delfinii",
    customer_email: "club@example.test",
    payment_intent: "pi_inv",
    charge: "ch_inv",
    hosted_invoice_url: "https://invoice.stripe.com/i/1",
    created: 1793782800,
    period_start: 1793782800,
    period_end: 1796461200,
    status_transitions: { paid_at: 1793782860 },
    lines: { data: [{ period: { start: 1793782800, end: 1796461200 } }] },
    subscription_details: { metadata: { subscriber_type: "CLUB" } },
    ...overrides,
  } as unknown as Stripe.Invoice;
}

const OWNER = { id: "row_1", subscriber_type: "CLUB" as const, plan_code: "CLUB" };

Deno.test("invoiceStatus never downgrades a refunded or paid invoice", () => {
  assertEquals(invoiceStatus("invoice.paid", null), "PAID");
  assertEquals(invoiceStatus("invoice.payment_failed", null), "FAILED");
  assertEquals(invoiceStatus("invoice.payment_failed", "PAID"), "PAID");
  assertEquals(invoiceStatus("invoice.paid", "REFUNDED"), "REFUNDED");
  assertEquals(invoiceStatus("invoice.paid", "FAILED"), "PAID");
});

Deno.test("a paid invoice maps to a history row with the card and period", () => {
  assertEquals(subscriptionInvoiceRow(invoice(), "invoice.paid", OWNER, null, { brand: "visa", last4: "4242" }), {
    stripe_invoice_id: "in_1",
    subscription_id: "row_1",
    subscriber_type: "CLUB",
    subscriber_name: "Club Delfinii",
    plan_code: "CLUB",
    stripe_payment_intent_id: "pi_inv",
    stripe_charge_id: "ch_inv",
    status: "PAID",
    amount: 34900,
    currency: "RON",
    billing_name: "Club Delfinii",
    billing_email: "club@example.test",
    card_brand: "visa",
    card_last4: "4242",
    hosted_invoice_url: "https://invoice.stripe.com/i/1",
    period_start: "2026-11-04T09:00:00.000Z",
    period_end: "2026-12-05T09:00:00.000Z",
    paid_at: "2026-11-04T09:01:00.000Z",
    created_at: "2026-11-04T09:00:00.000Z",
  });
});

Deno.test("a failed invoice keeps the amount due and no payment time", () => {
  const row = subscriptionInvoiceRow(invoice({ amount_paid: 0 }), "invoice.payment_failed", OWNER, null, null)!;
  assertEquals([row.status, row.amount, row.paid_at, row.card_last4], ["FAILED", 34900, null, null]);
});

Deno.test("zero invoices and unknown subscribers are not recorded", () => {
  assertEquals(subscriptionInvoiceRow(invoice({ amount_paid: 0, amount_due: 0 }), "invoice.paid", OWNER, null, null), null);
  assertEquals(
    subscriptionInvoiceRow(invoice({ subscription_details: { metadata: {} } }), "invoice.paid", null, null, null),
    null,
  );
  assertEquals(subscriptionInvoiceRow(invoice(), "invoice.paid", null, null, null)?.subscriber_type, "CLUB");
});
