import type Stripe from "https://esm.sh/stripe@14?target=deno";

export type InvoiceStatus = "PAID" | "FAILED" | "REFUNDED";

export interface InvoiceOwner {
  id: string;
  subscriber_type: "COACH" | "CLUB";
  plan_code: string | null;
}

export interface InvoiceCard {
  brand: string | null;
  last4: string | null;
}

export interface SubscriptionInvoiceRow {
  stripe_invoice_id: string;
  subscription_id: string | null;
  subscriber_type: "COACH" | "CLUB";
  subscriber_name: string | null;
  plan_code: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  status: InvoiceStatus;
  amount: number;
  currency: string;
  billing_name: string | null;
  billing_email: string | null;
  card_brand: string | null;
  card_last4: string | null;
  hosted_invoice_url: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id ?? null;

const isoOf = (seconds: number | null | undefined) =>
  typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;

export function invoiceStatus(eventType: string, previous: InvoiceStatus | null): InvoiceStatus {
  if (previous === "REFUNDED") return "REFUNDED";
  if (eventType === "invoice.paid") return "PAID";
  return previous === "PAID" ? "PAID" : "FAILED";
}

export function subscriptionInvoiceRow(
  invoice: Stripe.Invoice,
  eventType: string,
  owner: InvoiceOwner | null,
  previous: InvoiceStatus | null,
  card: InvoiceCard | null,
): SubscriptionInvoiceRow | null {
  const metadataType = invoice.subscription_details?.metadata?.subscriber_type;
  const subscriberType = owner?.subscriber_type ??
    (metadataType === "COACH" || metadataType === "CLUB" ? metadataType : null);
  if (!subscriberType) return null;
  const status = invoiceStatus(eventType, previous);
  const amount = status === "FAILED" ? invoice.amount_due : invoice.amount_paid;
  if (!amount || amount <= 0) return null;
  const line = invoice.lines?.data?.[0];
  const last4 = card?.last4 && /^[0-9]{4}$/.test(card.last4) ? card.last4 : null;
  return {
    stripe_invoice_id: invoice.id,
    subscription_id: owner?.id ?? null,
    subscriber_type: subscriberType,
    subscriber_name: invoice.customer_name ?? null,
    plan_code: owner?.plan_code ?? null,
    stripe_payment_intent_id: idOf(invoice.payment_intent as string | { id: string } | null),
    stripe_charge_id: idOf(invoice.charge as string | { id: string } | null),
    status,
    amount,
    currency: invoice.currency.toUpperCase(),
    billing_name: invoice.customer_name ?? null,
    billing_email: invoice.customer_email ?? null,
    card_brand: last4 ? card?.brand ?? null : null,
    card_last4: last4,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    period_start: isoOf(line?.period?.start ?? invoice.period_start),
    period_end: isoOf(line?.period?.end ?? invoice.period_end),
    paid_at: status === "FAILED" ? null : isoOf(invoice.status_transitions?.paid_at),
    created_at: isoOf(invoice.created) ?? new Date().toISOString(),
  };
}
