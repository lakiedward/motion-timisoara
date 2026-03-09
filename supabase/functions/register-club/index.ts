// Edge Function: register-club
// Replaces: POST /api/auth/register-club
// Handles: user creation (CLUB role), club entity, Stripe account

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";

interface RegisterClubRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  clubName: string;
  clubDescription?: string;
  clubAddress?: string;
  clubCity?: string;
  clubPhone?: string;
  clubEmail?: string;
  clubWebsite?: string;
  companyName?: string;
  companyCui?: string;
  companyRegNumber?: string;
  companyAddress?: string;
  bankAccount?: string;
  bankName?: string;
  sportIds?: string[];
}

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: RegisterClubRequest = await req.json();

    // 1. Create auth user with CLUB role
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin
      .createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { name: body.name, phone: body.phone, role: "CLUB" },
      });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const userId = authData.user.id;

    // 2. Create club entity
    const { data: club, error: clubErr } = await supabaseAdmin
      .from("clubs")
      .insert({
        owner_user_id: userId,
        name: body.clubName,
        description: body.clubDescription,
        address: body.clubAddress,
        city: body.clubCity,
        phone: body.clubPhone,
        email: body.clubEmail,
        website: body.clubWebsite,
        company_name: body.companyName,
        company_cui: body.companyCui,
        company_reg_number: body.companyRegNumber,
        company_address: body.companyAddress,
        bank_account: body.bankAccount,
        bank_name: body.bankName,
      })
      .select("id")
      .single();

    if (clubErr) {
      return new Response(
        JSON.stringify({ error: "Failed to create club" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. Link sports if provided
    if (body.sportIds?.length && club) {
      const sportLinks = body.sportIds.map((sportId) => ({
        club_id: club.id,
        sport_id: sportId,
      }));
      await supabaseAdmin.from("club_sports").insert(sportLinks);
    }

    // 4. Create Stripe Express account for club (fails gracefully)
    let stripeAccountId: string | null = null;
    try {
      const stripe = getStripe();
      const account = await stripe.accounts.create({
        type: "express",
        email: body.clubEmail || body.email,
        country: "RO",
        business_profile: { name: body.clubName },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "company",
        metadata: {
          club_id: club!.id,
          platform: "triathlon-team",
          account_type: "club",
        },
      });
      stripeAccountId = account.id;

      await supabaseAdmin
        .from("clubs")
        .update({
          stripe_account_id: account.id,
          stripe_onboarding_complete: false,
          stripe_charges_enabled: false,
          stripe_payouts_enabled: false,
        })
        .eq("id", club!.id);
    } catch (err) {
      console.warn("Stripe account creation failed (non-blocking):", err);
    }

    return new Response(
      JSON.stringify({
        userId,
        clubId: club!.id,
        stripeAccountId,
        message: "Club registered successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
