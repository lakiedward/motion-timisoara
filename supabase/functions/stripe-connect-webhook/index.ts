// Edge Function: stripe-connect-webhook
// Replaces: POST /api/webhooks/stripe/connect
// Handles: account.updated for coach/club Stripe accounts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getStripe } from "../_shared/stripe.ts";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")!;

  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
    });
  }

  console.log(
    `[STRIPE CONNECT] Webhook: type=${event.type} account=${event.account}`,
  );

  if (event.type === "account.updated" && event.account) {
    await handleAccountUpdate(event.account);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleAccountUpdate(stripeAccountId: string) {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(stripeAccountId);
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const onboardingComplete = chargesEnabled && payoutsEnabled;

  // Try coach_profiles first
  const { data: coachProfile } = await supabaseAdmin
    .from("coach_profiles")
    .select("id")
    .eq("stripe_account_id", stripeAccountId)
    .single();

  if (coachProfile) {
    await supabaseAdmin
      .from("coach_profiles")
      .update({
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_onboarding_complete: onboardingComplete,
      })
      .eq("id", coachProfile.id);
    console.log(
      `[STRIPE CONNECT] Updated coach ${coachProfile.id}: charges=${chargesEnabled}, payouts=${payoutsEnabled}`,
    );
    return;
  }

  // Try clubs
  const { data: club } = await supabaseAdmin
    .from("clubs")
    .select("id")
    .eq("stripe_account_id", stripeAccountId)
    .single();

  if (club) {
    await supabaseAdmin
      .from("clubs")
      .update({
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_onboarding_complete: onboardingComplete,
      })
      .eq("id", club.id);
    console.log(
      `[STRIPE CONNECT] Updated club ${club.id}: charges=${chargesEnabled}, payouts=${payoutsEnabled}`,
    );
    return;
  }

  console.warn(
    `[STRIPE CONNECT] Unknown account: ${stripeAccountId}`,
  );
}
