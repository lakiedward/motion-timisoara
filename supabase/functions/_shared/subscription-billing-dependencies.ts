import type Stripe from "https://esm.sh/stripe@14?target=deno";
import { supabaseAdmin } from "./supabase.ts";
import { getStripe } from "./stripe.ts";
import { TERMS_VERSION } from "./terms-version.ts";
import {
  billingFailure,
  type BillingLookup,
  type SubscriptionPlan,
  type SubscriptionRecord,
  type SubscriptionSettings,
} from "./subscription-billing.ts";
import type { SubscriptionCheckoutDependencies } from "../create-subscription-checkout/contract.ts";
import type { BillingPortalDependencies } from "../billing-portal/contract.ts";

const subscriptionColumns =
  "id,subscriber_type,plan_code,status,trial_end,stripe_customer_id,stripe_subscription_id";

function stripe(): Stripe {
  try {
    return getStripe();
  } catch {
    throw billingFailure("STRIPE_NOT_CONFIGURED");
  }
}

async function stripeCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Stripe subscription call failed", error);
    throw billingFailure("STRIPE_ERROR");
  }
}

const lookup: BillingLookup = {
  getCaller: async (token) => {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("role,enabled,deleted_at,email")
      .eq("id", data.user.id).maybeSingle();
    if (profileError) throw new Error("Caller profile lookup failed");
    const live = profile?.enabled === true && !profile.deleted_at;
    return {
      id: data.user.id,
      email: profile?.email ?? data.user.email ?? null,
      role: live ? profile.role ?? null : null,
    };
  },
  findOwnedClub: async (userId) => {
    const { data, error } = await supabaseAdmin.from("clubs")
      .select("id,name,email").eq("owner_user_id", userId)
      .order("created_at").limit(1).maybeSingle();
    if (error) throw new Error("Owned club lookup failed");
    return data ? { id: data.id, name: data.name, email: data.email } : null;
  },
  findSubscription: async (subscriber) => {
    const column = subscriber.type === "CLUB" ? "club_id" : "coach_user_id";
    const { data, error } = await supabaseAdmin.from("subscriptions")
      .select(subscriptionColumns).eq("subscriber_type", subscriber.type)
      .eq(column, subscriber.id).maybeSingle();
    if (error) throw new Error("Subscription lookup failed");
    return (data as SubscriptionRecord | null) ?? null;
  },
};

export function subscriptionCheckoutDependencies(): SubscriptionCheckoutDependencies {
  return {
    ...lookup,
    findPlan: async (code) => {
      const { data, error } = await supabaseAdmin.from("subscription_plans")
        .select("code,subscriber_type,coach_limit,stripe_price_id,active")
        .eq("code", code).maybeSingle();
      if (error) throw new Error("Plan lookup failed");
      return (data as SubscriptionPlan | null) ?? null;
    },
    getSettings: async () => {
      const { data, error } = await supabaseAdmin.from("subscription_settings")
        .select("launch_at,launch_trial_days").limit(1).maybeSingle();
      if (error || !data) throw new Error("Subscription settings missing");
      return data as SubscriptionSettings;
    },
    countClubCoaches: async (clubId) => {
      const { count, error } = await supabaseAdmin.from("club_coaches")
        .select("coach_profile_id", { count: "exact", head: true })
        .eq("club_id", clubId);
      if (error || count === null) throw new Error("Coach count failed");
      return count;
    },
    createCustomer: (params, idempotencyKey) =>
      stripeCall(async () =>
        (await stripe().customers.create(params, { idempotencyKey })).id
      ),
    saveCustomer: async (subscriptionId, customerId) => {
      const { error } = await supabaseAdmin.from("subscriptions")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId).is("stripe_customer_id", null);
      if (error) throw new Error("Customer save failed");
      const { data, error: readError } = await supabaseAdmin
        .from("subscriptions").select("stripe_customer_id")
        .eq("id", subscriptionId).single();
      if (readError || !data?.stripe_customer_id) {
        throw new Error("Customer save not visible");
      }
      return data.stripe_customer_id as string;
    },
    listOpenSessions: (customerId) =>
      stripeCall(async () => {
        const open = await stripe().checkout.sessions.list({
          customer: customerId,
          status: "open",
          limit: 20,
        });
        return open.data.map((session: Stripe.Checkout.Session) => ({
          id: session.id,
          url: session.url,
          mode: session.mode,
          successUrl: session.success_url,
          metadata: session.metadata ?? {},
        }));
      }),
    expireSession: (sessionId) =>
      stripeCall(async () => {
        await stripe().checkout.sessions.expire(sessionId);
      }),
    createCheckoutSession: (params, idempotencyKey) =>
      stripeCall(async () => {
        const session = await stripe().checkout.sessions.create(
          params as Stripe.Checkout.SessionCreateParams,
          { idempotencyKey },
        );
        return { id: session.id, url: session.url };
      }),
    termsVersion: TERMS_VERSION,
    now: () => Date.now(),
  };
}

export function billingPortalDependencies(): BillingPortalDependencies {
  return {
    ...lookup,
    createPortalSession: (params) =>
      stripeCall(async () =>
        (await stripe().billingPortal.sessions.create(params)).url
      ),
    portalConfiguration: Deno.env.get("STRIPE_BILLING_PORTAL_CONFIGURATION") ||
      null,
  };
}
