// Edge Function: register-coach
// Replaces: POST /api/auth/register-coach
// Handles: invitation code validation, user creation (COACH role), coach_profile, Stripe account

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";

interface RegisterCoachRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  invitationCode: string;
  bio?: string;
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

    const body: RegisterCoachRequest = await req.json();
    const { email, password, name, phone, invitationCode, bio, sportIds } =
      body;

    // 1. Validate invitation code
    const { data: code } = await supabaseAdmin
      .from("coach_invitation_codes")
      .select("*")
      .eq("code", invitationCode)
      .single();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Invalid invitation code" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invitation code expired" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (code.current_uses >= code.max_uses) {
      return new Response(
        JSON.stringify({ error: "Invitation code fully used" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Create auth user with COACH role
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, phone, role: "COACH" },
      });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const userId = authData.user.id;

    // 3. Create coach_profiles row
    const { data: coachProfile } = await supabaseAdmin
      .from("coach_profiles")
      .insert({
        user_id: userId,
        bio: bio ?? null,
      })
      .select("id")
      .single();

    // 4. Link sports if provided
    if (sportIds?.length && coachProfile) {
      const sportLinks = sportIds.map((sportId) => ({
        coach_profile_id: coachProfile.id,
        sport_id: sportId,
      }));
      await supabaseAdmin.from("coach_sports").insert(sportLinks);
    }

    // 5. Mark invitation code as used
    await supabaseAdmin
      .from("coach_invitation_codes")
      .update({
        current_uses: code.current_uses + 1,
        used_by_user_id: userId,
        used_at: new Date().toISOString(),
      })
      .eq("id", code.id);

    // 6. Create Stripe Express account (optional - fails gracefully)
    let stripeAccountId: string | null = null;
    try {
      const stripe = getStripe();
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
      stripeAccountId = account.id;

      if (coachProfile) {
        await supabaseAdmin
          .from("coach_profiles")
          .update({
            stripe_account_id: account.id,
            stripe_onboarding_complete: false,
            stripe_charges_enabled: false,
            stripe_payouts_enabled: false,
          })
          .eq("id", coachProfile.id);
      }
    } catch (err) {
      console.warn("Stripe account creation failed (non-blocking):", err);
    }

    // 7. Sign in the new user to return a session
    const { data: session, error: signInError } = await supabaseAdmin.auth
      .admin.generateLink({
        type: "magiclink",
        email,
      });

    return new Response(
      JSON.stringify({
        userId,
        stripeAccountId,
        message: "Coach registered successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
