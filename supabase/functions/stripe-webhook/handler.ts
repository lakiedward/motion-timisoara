import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyPaymentResult, notifyPaymentResult } from "../_shared/payment-completion.ts";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";
import type { SettlementLine, SettlementResult } from "../_shared/stripe-fee-settlement.ts";

export const PAYMENT_WEBHOOK_EVENTS = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.refund.updated",
]);

export type RefundOutcome = "created" | "updated" | "unknown";

interface Charge {
  paymentId: string;
  amount: number;
  gatewayId: string;
}

async function checkoutCharges(
  db: SupabaseClient,
  intent: Stripe.PaymentIntent,
  sessionForIntent: (intentId: string) => Promise<string | null>,
): Promise<Charge[] | Response> {
  const ids: string[] = intent.metadata.paymentIds.split(",").filter(Boolean);
  const sessionId = await sessionForIntent(intent.id);
  if (!sessionId) return enrollmentJson({ error: "Checkout session not found" }, 409);
  const { data, error } = await db.from("payments").select("id,amount,gateway_txn_id").in("id", ids);
  if (error) throw new Error("Payments could not be read");
  if (!data || data.length !== ids.length || data.some((row) => row.gateway_txn_id !== sessionId) ||
    data.reduce((sum, row) => sum + row.amount, 0) !== intent.amount) {
    return enrollmentJson({ error: "Checkout payments do not match the charge" }, 409);
  }
  return ids.map((id) => {
    const row = data.find((item) => item.id === id)!;
    return { paymentId: id, amount: row.amount, gatewayId: sessionId };
  });
}

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id ?? null;

export function paymentWebhookHandler({
  db,
  verifyEvent,
  sessionForIntent,
  settleFee,
  refundsOfCharge,
  recordRefund,
  saveCard,
}: {
  db: SupabaseClient;
  verifyEvent: (body: string, signature: string) => Promise<Stripe.Event>;
  sessionForIntent: (intentId: string) => Promise<string | null>;
  settleFee: (intent: Stripe.PaymentIntent, lines: SettlementLine[]) => Promise<SettlementResult>;
  refundsOfCharge?: (charge: Stripe.Charge) => Promise<Stripe.Refund[]>;
  recordRefund?: (refund: Stripe.Refund, sessionId: string | null) => Promise<RefundOutcome>;
  saveCard?: (intent: Stripe.PaymentIntent, paymentIds: string[]) => Promise<void>;
}) {
  async function syncRefunds(refunds: Stripe.Refund[]) {
    const outcomes: RefundOutcome[] = [];
    for (const refund of refunds) {
      const intentId = idOf(refund.payment_intent);
      const sessionId = intentId ? await sessionForIntent(intentId) : null;
      outcomes.push(await recordRefund!(refund, sessionId));
    }
    return outcomes;
  }

  return async (req: Request) => {
    if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
    const signature = req.headers.get("stripe-signature");
    if (!signature) return enrollmentJson({ error: "Missing signature" }, 400);
    let event: Stripe.Event;
    try {
      event = await verifyEvent(await req.text(), signature);
    } catch {
      return enrollmentJson({ error: "Invalid signature" }, 400);
    }
    if ((event.type === "charge.refunded" || event.type === "charge.refund.updated") && recordRefund) {
      try {
        const refunds = event.type === "charge.refund.updated"
          ? [event.data.object as Stripe.Refund]
          : await refundsOfCharge!(event.data.object as Stripe.Charge);
        return enrollmentJson({ received: true, type: event.type, refunds: await syncRefunds(refunds) });
      } catch {
        return enrollmentJson({ error: "Refund could not be recorded" }, 500);
      }
    }
    if (event.type !== "payment_intent.succeeded" && event.type !== "payment_intent.payment_failed") {
      return enrollmentJson({ received: true });
    }
    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentId = intent.metadata?.paymentId;
    if (!paymentId && !intent.metadata?.paymentIds) return enrollmentJson({ error: "Missing paymentId" }, 400);
    try {
      if (event.type === "payment_intent.succeeded" && intent.amount_received !== intent.amount) {
        return enrollmentJson({ error: "Received amount does not match the charge" }, 409);
      }
      const charges = paymentId
        ? [{ paymentId, amount: intent.amount, gatewayId: intent.id }]
        : await checkoutCharges(db, intent, sessionForIntent);
      if (charges instanceof Response) return charges;
      for (const charge of charges) {
        const result = await applyPaymentResult(db, {
          paymentId: charge.paymentId,
          result: event.type === "payment_intent.succeeded" ? "SUCCEEDED" : "FAILED",
          amount: charge.amount,
          currency: intent.currency.toUpperCase(),
          method: "CARD",
          gatewayId: charge.gatewayId,
        });
        await notifyPaymentResult(db, result, intent.last_payment_error?.message);
      }
      if (event.type === "payment_intent.succeeded" && saveCard) {
        await saveCard(intent, charges.map(({ paymentId }) => paymentId)).catch(() => undefined);
      }
      if (event.type === "payment_intent.succeeded") {
        let settlement: SettlementResult;
        try {
          settlement = await settleFee(intent, charges.map(({ paymentId, amount }) => ({ paymentId, amount })));
        } catch {
          return enrollmentJson({ error: "Stripe fee could not be settled" }, 500);
        }
        if (settlement === "pending") return enrollmentJson({ error: "Stripe fee is not available yet" }, 503);
      }
      return enrollmentJson({ received: true, type: event.type });
    } catch {
      return enrollmentJson({ error: "Payment confirmation could not be persisted" }, 500);
    }
  };
}
