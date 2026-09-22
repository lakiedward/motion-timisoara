import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";

export interface CompetitionPaymentRecipient {
  accountId: string | null;
  type: "PLATFORM" | "COACH" | "CLUB";
  coachId: string | null;
  clubId: string | null;
}

export async function competitionPaymentRecipient(
  db: SupabaseClient,
  competitionId: string,
): Promise<CompetitionPaymentRecipient> {
  const { data: competition, error } = await db
    .from("competitions")
    .select("club_id,coach_id")
    .eq("id", competitionId)
    .single();
  if (error || !competition || (competition.club_id && competition.coach_id)) {
    throw enrollmentJson(
      { error: "Organizatorul concursului nu poate fi verificat." },
      409,
    );
  }
  if (!competition.club_id && !competition.coach_id) {
    return { accountId: null, type: "PLATFORM", coachId: null, clubId: null };
  }
  const club = Boolean(competition.club_id);
  const table = club ? "clubs" : "coach_profiles";
  const ownerId = club ? competition.club_id : competition.coach_id;
  const key = club ? "id" : "user_id";
  const { data: recipient, error: recipientError } = await db
    .from(table)
    .select(
      "stripe_account_id,stripe_onboarding_complete,stripe_charges_enabled,stripe_payouts_enabled",
    )
    .eq(key, ownerId)
    .single();
  if (
    recipientError ||
    !recipient?.stripe_account_id ||
    !recipient.stripe_onboarding_complete ||
    !recipient.stripe_charges_enabled ||
    !recipient.stripe_payouts_enabled
  ) {
    throw enrollmentJson(
      {
        error: "Organizatorul nu poate primi încă plăți cu cardul. Alege plata cash sau contactează organizatorul.",
      },
      409,
    );
  }
  return {
    accountId: recipient.stripe_account_id,
    type: club ? "CLUB" : "COACH",
    coachId: club ? null : competition.coach_id,
    clubId: club ? competition.club_id : null,
  };
}
