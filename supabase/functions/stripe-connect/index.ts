// Edge Function: stripe-connect
// Replaces: StripeConnectService.kt
// Handles: create-account, onboarding-link, dashboard-link, refresh-status
// Route by action parameter

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser, getUserRole } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "http://localhost:4200";

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await getUser(req);
    const role = await getUserRole(user.id);
    const body = await req.json();
    const { action } = body;

    const stripe = getStripe();

    switch (action) {
      case "create-account": {
        // Coach or Club creates a Stripe Express account
        if (role === "COACH") {
          return await createCoachAccount(stripe, user.id, user.email!);
        } else if (role === "CLUB") {
          const { data: club } = await supabaseAdmin
            .from("clubs")
            .select("id, name, email")
            .eq("owner_user_id", user.id)
            .single();
          if (!club) {
            return jsonResponse({ error: "Club not found" }, 404);
          }
          return await createClubAccount(
            stripe,
            club.id,
            club.email || user.email!,
            club.name,
          );
        }
        return jsonResponse({ error: "Only coaches and clubs can create Stripe accounts" }, 403);
      }

      case "onboarding-link": {
        if (role === "COACH") {
          return await getCoachOnboardingLink(stripe, user.id);
        } else if (role === "CLUB") {
          return await getClubOnboardingLink(stripe, user.id);
        }
        return jsonResponse({ error: "Not authorized" }, 403);
      }

      case "dashboard-link": {
        if (role === "COACH") {
          return await getCoachDashboardLink(stripe, user.id);
        } else if (role === "CLUB") {
          return await getClubDashboardLink(stripe, user.id);
        }
        return jsonResponse({ error: "Not authorized" }, 403);
      }

      case "refresh-status": {
        if (role === "COACH") {
          return await refreshCoachStatus(stripe, user.id);
        } else if (role === "CLUB") {
          return await refreshClubStatus(stripe, user.id);
        }
        return jsonResponse({ error: "Not authorized" }, 403);
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  }),
);

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function createCoachAccount(
  stripe: any,
  userId: string,
  email: string,
) {
  const { data: profile } = await supabaseAdmin
    .from("coach_profiles")
    .select("id, stripe_account_id")
    .eq("user_id", userId)
    .single();
  if (!profile) return jsonResponse({ error: "Coach profile not found" }, 404);
  if (profile.stripe_account_id) {
    return jsonResponse({ accountId: profile.stripe_account_id });
  }

  const account = await stripe.accounts.create({
    type: "express",
    email,
    country: "RO",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    metadata: { coach_user_id: userId, platform: "triathlon-team" },
  });

  await supabaseAdmin
    .from("coach_profiles")
    .update({
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    })
    .eq("id", profile.id);

  return jsonResponse({ accountId: account.id });
}

async function createClubAccount(
  stripe: any,
  clubId: string,
  email: string,
  businessName: string,
) {
  const { data: club } = await supabaseAdmin
    .from("clubs")
    .select("stripe_account_id")
    .eq("id", clubId)
    .single();
  if (club?.stripe_account_id) {
    return jsonResponse({ accountId: club.stripe_account_id });
  }

  const account = await stripe.accounts.create({
    type: "express",
    email,
    country: "RO",
    business_profile: { name: businessName },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "company",
    metadata: {
      club_id: clubId,
      platform: "triathlon-team",
      account_type: "club",
    },
  });

  await supabaseAdmin
    .from("clubs")
    .update({
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    })
    .eq("id", clubId);

  return jsonResponse({ accountId: account.id });
}

async function getCoachOnboardingLink(stripe: any, userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("coach_profiles")
    .select("stripe_account_id")
    .eq("user_id", userId)
    .single();
  if (!profile?.stripe_account_id) {
    return jsonResponse({ error: "No Stripe account" }, 400);
  }

  const link = await stripe.accountLinks.create({
    account: profile.stripe_account_id,
    refresh_url: `${FRONTEND_URL}/stripe/onboarding/refresh`,
    return_url: `${FRONTEND_URL}/stripe/onboarding/complete`,
    type: "account_onboarding",
  });
  return jsonResponse({ url: link.url });
}

async function getClubOnboardingLink(stripe: any, userId: string) {
  const { data: club } = await supabaseAdmin
    .from("clubs")
    .select("stripe_account_id")
    .eq("owner_user_id", userId)
    .single();
  if (!club?.stripe_account_id) {
    return jsonResponse({ error: "No Stripe account" }, 400);
  }

  const link = await stripe.accountLinks.create({
    account: club.stripe_account_id,
    refresh_url: `${FRONTEND_URL}/club/stripe/onboarding/refresh`,
    return_url: `${FRONTEND_URL}/club/stripe/onboarding/complete`,
    type: "account_onboarding",
  });
  return jsonResponse({ url: link.url });
}

async function getCoachDashboardLink(stripe: any, userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("coach_profiles")
    .select("stripe_account_id")
    .eq("user_id", userId)
    .single();
  if (!profile?.stripe_account_id) {
    return jsonResponse({ error: "No Stripe account" }, 400);
  }

  const link = await stripe.accounts.createLoginLink(
    profile.stripe_account_id,
  );
  return jsonResponse({ url: link.url });
}

async function getClubDashboardLink(stripe: any, userId: string) {
  const { data: club } = await supabaseAdmin
    .from("clubs")
    .select("stripe_account_id")
    .eq("owner_user_id", userId)
    .single();
  if (!club?.stripe_account_id) {
    return jsonResponse({ error: "No Stripe account" }, 400);
  }

  const link = await stripe.accounts.createLoginLink(club.stripe_account_id);
  return jsonResponse({ url: link.url });
}

async function refreshCoachStatus(stripe: any, userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("coach_profiles")
    .select("id, stripe_account_id")
    .eq("user_id", userId)
    .single();
  if (!profile?.stripe_account_id) {
    return jsonResponse({
      hasAccount: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      requiresAction: true,
    });
  }

  const account = await stripe.accounts.retrieve(profile.stripe_account_id);
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const onboardingComplete = chargesEnabled && payoutsEnabled;

  await supabaseAdmin
    .from("coach_profiles")
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_onboarding_complete: onboardingComplete,
    })
    .eq("id", profile.id);

  return jsonResponse({
    hasAccount: true,
    onboardingComplete,
    chargesEnabled,
    payoutsEnabled,
    requiresAction: !onboardingComplete,
    accountId: profile.stripe_account_id,
  });
}

async function refreshClubStatus(stripe: any, userId: string) {
  const { data: club } = await supabaseAdmin
    .from("clubs")
    .select("id, stripe_account_id")
    .eq("owner_user_id", userId)
    .single();
  if (!club?.stripe_account_id) {
    return jsonResponse({
      hasAccount: false,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      requiresAction: true,
    });
  }

  const account = await stripe.accounts.retrieve(club.stripe_account_id);
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;
  const onboardingComplete = chargesEnabled && payoutsEnabled;

  await supabaseAdmin
    .from("clubs")
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_onboarding_complete: onboardingComplete,
    })
    .eq("id", club.id);

  return jsonResponse({
    hasAccount: true,
    onboardingComplete,
    chargesEnabled,
    payoutsEnabled,
    requiresAction: !onboardingComplete,
    accountId: club.stripe_account_id,
  });
}
