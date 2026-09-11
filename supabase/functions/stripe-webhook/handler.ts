import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyPaymentResult, notifyPaymentResult } from "../_shared/payment-completion.ts";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";

export function paymentWebhookHandler({ db, verifyEvent }: {
  db: SupabaseClient;
  verifyEvent: (body: string, signature: string) => Promise<Stripe.Event>;
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
    if (!paymentId) return enrollmentJson({ error: "Missing paymentId" }, 400);
    try {
      if (event.type === "payment_intent.succeeded" && intent.amount_received !== intent.amount) {
        return enrollmentJson({ error: "Received amount does not match the charge" }, 409);
      }
      const result = await applyPaymentResult(db, {
        paymentId, result: event.type === "payment_intent.succeeded" ? "SUCCEEDED" : "FAILED",
        amount: intent.amount, currency: intent.currency.toUpperCase(), method: "CARD", gatewayId: intent.id,
      });
      await notifyPaymentResult(db, result, intent.last_payment_error?.message);
      return enrollmentJson({ received: true, type: event.type });
    } catch {
      return enrollmentJson({ error: "Payment confirmation could not be persisted" }, 500);
    }
  };
}
