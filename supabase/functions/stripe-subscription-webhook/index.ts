import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getStripe } from "../_shared/stripe.ts";
import { toStripeState } from "../_shared/subscription-sync.ts";
import { subscriptionWebhookHandler } from "./handler.ts";
import { supabaseSubscriptionStore } from "./store.ts";

serve(subscriptionWebhookHandler({
  store: supabaseSubscriptionStore(supabaseAdmin),
  verifyEvent: async (body, signature) => {
    const secret = Deno.env.get("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET");
    if (!secret) throw new Error("Subscription webhook is not configured");
    return await getStripe().webhooks.constructEventAsync(body, signature, secret);
  },
  subscription: async (id) =>
    toStripeState(await getStripe().subscriptions.retrieve(id, { expand: ["latest_invoice"] })),
}));
