import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyPaymentResult, notifyPaymentResult } from "../_shared/payment-completion.ts";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";

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

export function paymentWebhookHandler({ db, verifyEvent, sessionForIntent }: {
  db: SupabaseClient;
  verifyEvent: (body: string, signature: string) => Promise<Stripe.Event>;
  sessionForIntent: (intentId: string) => Promise<string | null>;
}) {
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
      return enrollmentJson({ received: true, type: event.type });
    } catch {
      return enrollmentJson({ error: "Payment confirmation could not be persisted" }, 500);
    }
  };
}
