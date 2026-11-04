import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getStripe } from "../_shared/stripe.ts";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: "Webhook is not configured" }), {
      status: 503,
    });
  }

  const stripe = getStripe();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
    });
  }

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
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

  const { data: coachProfile } = await supabaseAdmin
    .from("coach_profiles")
    .select("id")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();

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

  const { data: club } = await supabaseAdmin
    .from("clubs")
    .select("id")
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();

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
