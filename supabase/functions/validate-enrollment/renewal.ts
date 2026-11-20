import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";
import { loadRenewalTarget, MAX_RENEWAL_SESSIONS, renewalQuote, validRenewalRequest } from "../_shared/course-renewal.ts";
import { resolveCourseChoice } from "../_shared/course-package.ts";
import { offerAcceptsEnrollments, SUBSCRIPTION_INACTIVE_MESSAGE } from "../_shared/subscription-access.ts";

export async function validateRenewal(
  db: SupabaseClient,
  parentId: string,
  body: { renewEnrollmentId?: unknown; sessionPackageSize?: unknown; coursePackageId?: unknown },
): Promise<Response> {
  const quantity = body.sessionPackageSize ?? 1;
  if (!validRenewalRequest(body.renewEnrollmentId, quantity)) {
    const tooMany = typeof quantity === "number" && quantity > MAX_RENEWAL_SESSIONS;
    return enrollmentJson({
      error: tooMany ? `Poți cumpăra cel mult ${MAX_RENEWAL_SESSIONS} de ședințe odată.` : "Numărul de ședințe nu este valid.",
    }, 400);
  }
  const target = await loadRenewalTarget(db, parentId, body.renewEnrollmentId);
  let accepts: boolean;
  try {
    accepts = await offerAcceptsEnrollments(db, "COURSE", target.courseId);
  } catch {
    return enrollmentJson({ error: "Nu am putut verifica oferta. Reîncearcă." }, 503);
  }
  const base = {
    enrollmentId: target.enrollmentId,
    childId: target.childId,
    name: target.childName,
    courseId: target.courseId,
    remainingSessions: target.remainingSessions,
    openPayment: target.openPayment,
  };
  if (!accepts) {
    return enrollmentJson({
      renewal: { ...base, eligible: false, severity: "error", reason: SUBSCRIPTION_INACTIVE_MESSAGE },
      allowCash: true,
    });
  }
  const quote = await renewalQuote(target, await resolveCourseChoice(db, target.courseId, body));
  return enrollmentJson({
    renewal: {
      ...base,
      eligible: true,
      amount: quote.amount,
      currency: quote.currency,
      priceVersion: quote.priceVersion,
      pricingSnapshot: quote.snapshot,
    },
    allowCash: true,
  });
}
