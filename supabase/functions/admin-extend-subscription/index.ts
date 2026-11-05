import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getUser, getUserRole, supabaseAdmin } from "../_shared/supabase.ts";
import { getStripe } from "../_shared/stripe.ts";
import { withCors } from "../_shared/cors.ts";
import { adminExtendHandler, ExtensionRpcError, type ExtensionPlan } from "./handler.ts";

serve(withCors(adminExtendHandler({
  getUser,
  getUserRole,
  beginExtension: async (subscriptionId, days) => {
    const { data, error } = await supabaseAdmin.rpc("begin_subscription_extension", {
      p_subscription_id: subscriptionId,
      p_days: days,
    });
    if (error) throw new ExtensionRpcError(error.message, error.code);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new ExtensionRpcError("SUBSCRIPTION_NOT_FOUND", "P0002");
    return {
      status: row.status,
      previousEnd: row.previous_end,
      newEnd: row.new_end,
      stripeSubscriptionId: row.stripe_subscription_id,
    } as ExtensionPlan;
  },
  stripeSubscriptionStatus: async (stripeSubscriptionId) =>
    (await getStripe().subscriptions.retrieve(stripeSubscriptionId)).status,
  setStripeTrialEnd: async (stripeSubscriptionId, trialEndSeconds) => {
    await getStripe().subscriptions.update(stripeSubscriptionId, {
      trial_end: trialEndSeconds,
      proration_behavior: "none",
    });
  },
  applyExtension: async (request, adminId, newEnd) => {
    const { data, error } = await supabaseAdmin.rpc("apply_subscription_extension", {
      p_subscription_id: request.subscriptionId,
      p_admin_user_id: adminId,
      p_days: request.days,
      p_reason: request.reason,
      p_new_end: newEnd,
    });
    if (error) throw new Error("Extension could not be applied");
    return data as string;
  },
})));
