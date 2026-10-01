import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";
import {
  coachInvitationDatabaseFailure,
  coachInvitationParameters,
  invitationAvailability,
  parseCoachInvitationResult,
} from "../_shared/coach-invitation.ts";
import { registerCoachHandler } from "./contract.ts";

serve(withCors(registerCoachHandler({
  preflight: async (invitationCode) => {
    const { data, error } = await supabaseAdmin.from("coach_invitation_codes")
      .select("expires_at,current_uses,max_uses").eq("code", invitationCode)
      .maybeSingle();
    return error ? "SERVER_ERROR" : invitationAvailability(data);
  },
  createUser: async (payload) => {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { name: payload.name, phone: payload.phone },
    });
    if (error || !data.user) {
      return {
        error: error?.code === "email_exists" ||
            /already.*registered/i.test(error?.message ?? "")
          ? "ACCOUNT_EXISTS"
          : "INVALID_REQUEST",
      };
    }
    return { id: data.user.id };
  },
  redeem: async (userId, payload) => {
    const { data, error } = await supabaseAdmin.rpc(
      "redeem_coach_invitation",
      coachInvitationParameters(userId, payload),
    );
    if (error) return { error: coachInvitationDatabaseFailure(error) };
    const result = parseCoachInvitationResult(data);
    return result ? { data: result } : { error: "SERVER_ERROR" };
  },
  deleteCreatedUser: async (userId) => {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles").select("role").eq("id", userId).maybeSingle();
    const { data: coach, error: coachError } = await supabaseAdmin
      .from("coach_profiles").select("id").eq("user_id", userId).maybeSingle();
    if (
      profileError || coachError || coach ||
      (profile && profile.role !== "PARENT")
    ) {
      throw new Error(
        "New auth user cleanup could not confirm an unpromoted identity",
      );
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error("New auth user cleanup failed");
  },
  createStripeAccount: async (userId, coachProfileId, email) => {
    const account = await getStripe().accounts.create({
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
    const { error } = await supabaseAdmin.from("coach_profiles").update({
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    }).eq("id", coachProfileId);
    if (error) {
      console.warn("register-coach: optional Stripe profile link failed");
    }
    return account.id;
  },
})));
