import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUBSCRIPTION_INACTIVE = "SUBSCRIPTION_INACTIVE";
export const SUBSCRIPTION_INACTIVE_MESSAGE = "Această ofertă nu primește înscrieri momentan.";

export type EnrollmentOfferKind = "COURSE" | "CAMP" | "ACTIVITY" | "COMPETITION";

export async function offerAcceptsEnrollments(
  db: Pick<SupabaseClient, "rpc">,
  kind: EnrollmentOfferKind,
  entityId: string,
): Promise<boolean> {
  const { data, error } = await db.rpc("enrollment_offer_has_access", {
    p_kind: kind,
    p_entity_id: entityId,
  });
  if (error || typeof data !== "boolean") throw new Error("Subscription access check failed");
  return data;
}

export function subscriptionInactiveBody() {
  return { error: SUBSCRIPTION_INACTIVE_MESSAGE, code: SUBSCRIPTION_INACTIVE };
}
