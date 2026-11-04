import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getStripe } from "../_shared/stripe.ts";
import { settleStripeFee } from "../_shared/stripe-fee-settlement.ts";
import { paymentWebhookHandler } from "./handler.ts";

serve(paymentWebhookHandler({
  db: supabaseAdmin,
  verifyEvent: async (body, signature) => {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!secret) throw new Error("Webhook is not configured");
    return await getStripe().webhooks.constructEventAsync(body, signature, secret);
  },
  sessionForIntent: async (intentId) => {
    const sessions = await getStripe().checkout.sessions.list({ payment_intent: intentId, limit: 1 });
    return sessions.data[0]?.id ?? null;
  },
  settleFee: (intent, lines) => settleStripeFee(supabaseAdmin, getStripe(), intent, lines),
  refundsOfCharge: async (charge) =>
    (await getStripe().refunds.list({ charge: charge.id, limit: 100 })).data,
  recordRefund: async (refund, sessionId) => {
    const { data, error } = await supabaseAdmin.rpc("record_stripe_refund", {
      p_stripe_refund_id: refund.id,
      p_payment_intent_id: typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id ?? null,
      p_checkout_session_id: sessionId,
      p_refund_row_id: refund.metadata?.refund_row_id || null,
      p_amount: refund.amount,
      p_currency: refund.currency.toUpperCase(),
      p_status: refund.status ?? "pending",
      p_failure_reason: refund.failure_reason ?? null,
    });
    if (error) throw new Error("Refund could not be recorded");
    return data as "created" | "updated" | "unknown";
  },
  saveCard: async (intent, paymentIds) => {
    const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
    if (!chargeId || paymentIds.length === 0) return;
    const card = (await getStripe().charges.retrieve(chargeId)).payment_method_details?.card;
    if (!card?.last4) return;
    await supabaseAdmin.from("payments")
      .update({ card_brand: card.brand ?? null, card_last4: card.last4 })
      .in("id", paymentIds);
  },
}));
