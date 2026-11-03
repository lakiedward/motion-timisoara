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
}));
