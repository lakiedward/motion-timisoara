import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { competitionPaymentRecipient } from "./competition-payment-recipient.ts";

export interface PaymentRecipient {
  accountId: string | null;
  type: string;
  coachId: string | null;
  clubId: string | null;
}

export async function paymentRecipient(
  supabaseAdmin: SupabaseClient,
  enrollment: { kind: string; entity_id: string },
): Promise<PaymentRecipient> {
  let destinationAccountId: string | null = null;
  let destinationType = "PLATFORM";
  let coachId: string | null = null;
  let clubId: string | null = null;

  if (enrollment.kind === "COURSE" || enrollment.kind === "ACTIVITY") {
    const table = enrollment.kind === "COURSE" ? "courses" : "activities";
    const { data: entity } = await supabaseAdmin
      .from(table)
      .select("coach_id, club_id, payment_recipient")
      .eq("id", enrollment.entity_id)
      .single();

    if (entity) {
      coachId = entity.coach_id;
      clubId = entity.club_id;
      const recipient = entity.payment_recipient;

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
          cp?.stripe_onboarding_complete &&
          cp?.stripe_charges_enabled &&
          cp?.stripe_payouts_enabled
        ) {
          coachStripeAccount = cp.stripe_account_id;
          coachCanReceive = true;
        }
      }

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
          cl?.stripe_onboarding_complete &&
          cl?.stripe_charges_enabled &&
          cl?.stripe_payouts_enabled
        ) {
          clubStripeAccount = cl.stripe_account_id;
          clubCanReceive = true;
        }
      }

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
        if (coachCanReceive) {
          destinationAccountId = coachStripeAccount;
          destinationType = "COACH";
        } else if (clubCanReceive) {
          destinationAccountId = clubStripeAccount;
          destinationType = "CLUB";
        }
      }
    }
  } else if (enrollment.kind === "COMPETITION") {
    const recipient = await competitionPaymentRecipient(
      supabaseAdmin,
      enrollment.entity_id,
    );
    destinationAccountId = recipient.accountId;
    destinationType = recipient.type;
    coachId = recipient.coachId;
    clubId = recipient.clubId;
  }
  return {
    accountId: destinationAccountId,
    type: destinationType,
    coachId,
    clubId,
  };
}
