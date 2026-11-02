import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";
import { lookupAnafCompany } from "../_shared/company-cui.ts";
import { registerClubHandler } from "./contract.ts";

serve(withCors(registerClubHandler({
  lookupCompany: (cui) => lookupAnafCompany(cui),
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
  promoteToClub: async (userId) => {
    const { error } = await supabaseAdmin.from("profiles")
      .update({ role: "CLUB" }).eq("id", userId);
    if (error) console.error("register-club: role elevation failed:", error);
    return !error;
  },
  insertClub: async ({ ownerUserId, payload, company }) => {
    const { data, error } = await supabaseAdmin.from("clubs").insert({
      owner_user_id: ownerUserId,
      name: payload.clubName,
      city: payload.clubCity,
      phone: payload.phone,
      email: payload.email,
      company_cui: payload.companyCui,
      company_name: company?.name ?? null,
      company_address: company?.address ?? null,
      company_reg_number: company?.regNumber ?? null,
    }).select("id").single();
    if (error) console.error("register-club: club insert failed:", error);
    return data?.id ?? null;
  },
  linkSports: async (clubId, sportIds) => {
    const { error } = await supabaseAdmin.from("club_sports")
      .insert(sportIds.map((sportId) => ({ club_id: clubId, sport_id: sportId })));
    if (error) console.warn("register-club: sports link failed:", error);
  },
  deleteCreatedUser: async (userId) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) console.error("register-club: cleanup failed:", error);
  },
  createStripeAccount: async (clubId, payload) => {
    const account = await getStripe().accounts.create({
      type: "express",
      email: payload.email,
      country: "RO",
      business_profile: { name: payload.clubName },
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
    await supabaseAdmin.from("clubs").update({
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    }).eq("id", clubId);
    return account.id;
  },
})));
