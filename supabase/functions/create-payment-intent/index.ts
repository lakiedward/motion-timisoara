// Edge Function: create-payment-intent
// Replaces: POST /api/payments/{enrollmentId}/intent
// Handles: Stripe PaymentIntent creation with Connect transfer and platform fee

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { getStripe, calculatePlatformFee } from "../_shared/stripe.ts";

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await getUser(req);
    const { enrollmentId } = await req.json();

    // Get payment for this enrollment
    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .single();
    if (payErr || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not initialized" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (payment.method !== "CARD") {
      return new Response(
        JSON.stringify({
          error: "Payment intent required only for card payments",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get enrollment
    const { data: enrollment } = await supabaseAdmin
      .from("enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .single();
    if (!enrollment) {
      return new Response(
        JSON.stringify({ error: "Enrollment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // Determine currency
    let currency = payment.currency || "RON";
    if (!currency || currency === "") {
      if (enrollment.kind === "COURSE") {
        const { data: c } = await supabaseAdmin
          .from("courses")
          .select("currency")
          .eq("id", enrollment.entity_id)
          .single();
        currency = c?.currency ?? "RON";
      } else if (enrollment.kind === "CAMP") {
        const { data: c } = await supabaseAdmin
          .from("camps")
          .select("currency")
          .eq("id", enrollment.entity_id)
          .single();
        currency = c?.currency ?? "RON";
      } else {
        const { data: c } = await supabaseAdmin
          .from("activities")
          .select("currency")
          .eq("id", enrollment.entity_id)
          .single();
        currency = c?.currency ?? "RON";
      }
    }

    // Determine payment destination (coach or club)
    let destinationAccountId: string | null = null;
    let destinationType = "PLATFORM";
    let coachId: string | null = null;
    let clubId: string | null = null;

    if (enrollment.kind === "COURSE" || enrollment.kind === "ACTIVITY") {
      const table = enrollment.kind === "COURSE" ? "courses" : "activities";
      const { data: entity } = await supabaseAdmin
        .from(table)
        .select(
          "coach_id, club_id, payment_recipient",
        )
        .eq("id", enrollment.entity_id)
        .single();

      if (entity) {
        coachId = entity.coach_id;
        clubId = entity.club_id;
        const recipient = entity.payment_recipient;

        // Get coach's Stripe account
        let coachStripeAccount: string | null = null;
        let coachCanReceive = false;
        if (coachId) {
          const { data: cp } = await supabaseAdmin
            .from("coach_profiles")
            .select(
              "stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled",
            )
            .eq("user_id", coachId)
            .single();
          if (
            cp?.stripe_onboarding_complete && cp?.stripe_charges_enabled &&
            cp?.stripe_payouts_enabled
          ) {
            coachStripeAccount = cp.stripe_account_id;
            coachCanReceive = true;
          }
        }

        // Get club's Stripe account
        let clubStripeAccount: string | null = null;
        let clubCanReceive = false;
        if (clubId) {
          const { data: cl } = await supabaseAdmin
            .from("clubs")
            .select(
              "stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled",
            )
            .eq("id", clubId)
            .single();
          if (
            cl?.stripe_onboarding_complete && cl?.stripe_charges_enabled &&
            cl?.stripe_payouts_enabled
          ) {
            clubStripeAccount = cl.stripe_account_id;
            clubCanReceive = true;
          }
        }

        // Determine destination based on payment_recipient config
        if (recipient === "CLUB") {
          if (clubCanReceive) {
            destinationAccountId = clubStripeAccount;
            destinationType = "CLUB";
          } else if (coachCanReceive) {
            destinationAccountId = coachStripeAccount;
            destinationType = "COACH";
          }
        } else if (recipient === "COACH") {
          if (coachCanReceive) {
            destinationAccountId = coachStripeAccount;
            destinationType = "COACH";
          } else if (clubCanReceive) {
            destinationAccountId = clubStripeAccount;
            destinationType = "CLUB";
          }
        } else {
          // Legacy fallback
          if (coachCanReceive) {
            destinationAccountId = coachStripeAccount;
            destinationType = "COACH";
          } else if (clubCanReceive) {
            destinationAccountId = clubStripeAccount;
            destinationType = "CLUB";
          }
        }
      }
    }

    const stripe = getStripe();
    const amountInBani = payment.amount;

    const params: any = {
      amount: amountInBani,
      currency: currency.toLowerCase(),
      metadata: {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
      },
    };

    // Add Stripe Connect transfer if destination available
    if (destinationAccountId) {
      const fee = calculatePlatformFee(amountInBani);
      params.application_fee_amount = fee.platformFeeTotal;
      params.transfer_data = { destination: destinationAccountId };
      params.metadata.destinationType = destinationType;
      params.metadata.platformFee = fee.platformFeeTotal.toString();
      params.metadata.recipientAmount = fee.recipientAmount.toString();
      if (coachId) params.metadata.coachId = coachId;
      if (destinationType === "CLUB" && clubId) {
        params.metadata.clubId = clubId;
      }

      // Store fee breakdown in payment
      await supabaseAdmin
        .from("payments")
        .update({
          platform_fee_amount: fee.platformFeeTotal,
          coach_payout_amount: fee.recipientAmount,
        })
        .eq("id", payment.id);
    }

    if (payment.billing_email) {
      params.receipt_email = payment.billing_email;
    }

    const intent = await stripe.paymentIntents.create(params);

    // Save client_secret and gateway_txn_id
    await supabaseAdmin
      .from("payments")
      .update({
        client_secret: intent.client_secret,
        gateway_txn_id: intent.id,
      })
      .eq("id", payment.id);

    return new Response(
      JSON.stringify({ clientSecret: intent.client_secret }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
