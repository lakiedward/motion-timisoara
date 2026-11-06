import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getStripe } from "../_shared/stripe.ts";
import { toStripeState } from "../_shared/subscription-sync.ts";
import { subscriptionWebhookHandler } from "./handler.ts";
import { supabaseSubscriptionStore } from "./store.ts";
import { subscriptionInvoiceRow } from "../_shared/subscription-invoice.ts";

serve(subscriptionWebhookHandler({
  store: supabaseSubscriptionStore(supabaseAdmin),
  verifyEvent: async (body, signature) => {
    const secret = Deno.env.get("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET");
    if (!secret) throw new Error("Subscription webhook is not configured");
    return await getStripe().webhooks.constructEventAsync(body, signature, secret);
  },
  invoice: (id) => getStripe().invoices.retrieve(id),
  subscription: async (id) =>
    toStripeState(await getStripe().subscriptions.retrieve(id, { expand: ["latest_invoice"] })),
  recordInvoice: async (invoice, eventType, owner) => {
    const { data: previous, error: readError } = await supabaseAdmin.from("subscription_invoices")
      .select("status").eq("stripe_invoice_id", invoice.id).maybeSingle();
    if (readError) throw new Error("Invoice history could not be read");
    const chargeId = typeof invoice.charge === "string" ? invoice.charge : invoice.charge?.id;
    const card = chargeId
      ? (await getStripe().charges.retrieve(chargeId)).payment_method_details?.card ?? null
      : null;
    const row = subscriptionInvoiceRow(
      invoice,
      eventType,
      owner ? { id: owner.id, subscriber_type: owner.subscriber_type, plan_code: owner.plan_code } : null,
      previous?.status ?? null,
      card ? { brand: card.brand ?? null, last4: card.last4 ?? null } : null,
    );
    if (!row) return;
    const { error } = await supabaseAdmin.from("subscription_invoices")
      .upsert(row, { onConflict: "stripe_invoice_id" });
    if (error) throw new Error("Invoice history could not be saved");
  },
}));
