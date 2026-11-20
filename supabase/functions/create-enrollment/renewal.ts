import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";
import { loadRenewalTarget, renewalQuote, validRenewalRequest } from "../_shared/course-renewal.ts";
import { buildCheckoutAcceptance, type ClientAcceptance } from "../_shared/checkout-acceptance.ts";
import { offerAcceptsEnrollments, subscriptionInactiveBody } from "../_shared/subscription-access.ts";

interface RenewalRequest {
  renewEnrollmentId?: unknown;
  sessionPackageSize?: unknown;
  paymentMethod?: unknown;
  priceVersion?: unknown;
  billingDetails?: unknown;
  acceptance?: ClientAcceptance;
}

const BILLING_FIELDS = ["name", "email", "addressLine1", "city", "postalCode"];
const KNOWN_CODES = ["PRICE_CHANGED", "SUBSCRIPTION_INACTIVE", "RENEWAL_IN_PROGRESS"];

function validBilling(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const billing = value as Record<string, unknown>;
  return BILLING_FIELDS.every((field) => typeof billing[field] === "string" && (billing[field] as string).trim().length > 0 &&
    (billing[field] as string).length <= 200);
}

export async function createRenewal(db: SupabaseClient, parentId: string, body: RenewalRequest): Promise<Response> {
  const quantity = body.sessionPackageSize ?? 1;
  const method = body.paymentMethod;
  if (!validRenewalRequest(body.renewEnrollmentId, quantity) || (method !== "CARD" && method !== "CASH")) {
    return enrollmentJson({ error: "Cererea de reînnoire nu este validă." }, 400);
  }
  if (method === "CARD" && !validBilling(body.billingDetails)) {
    return enrollmentJson({ error: "Completează datele de facturare" }, 400);
  }
  const target = await loadRenewalTarget(db, parentId, body.renewEnrollmentId);
  let accepts: boolean;
  try {
    accepts = await offerAcceptsEnrollments(db, "COURSE", target.courseId);
  } catch {
    return enrollmentJson({ error: "Nu am putut verifica oferta. Reîncearcă." }, 503);
  }
  if (!accepts) return enrollmentJson(subscriptionInactiveBody(), 409);
  const quote = await renewalQuote(target, quantity as number);
  if (body.priceVersion !== quote.priceVersion) {
    return enrollmentJson({ error: "Prețul s-a schimbat. Revino la Detalii și verifică din nou suma.", code: "PRICE_CHANGED" }, 409);
  }
  const acceptance = await buildCheckoutAcceptance(db, "COURSE", target.courseId, body.acceptance);
  const { data, error } = await db.rpc("start_course_renewal", {
    p_parent_id: parentId,
    p_enrollment_id: target.enrollmentId,
    p_method: method,
    p_quote: {
      childId: target.childId,
      amount: quote.amount,
      currency: quote.currency,
      priceVersion: quote.priceVersion,
      snapshot: quote.snapshot,
    },
    p_billing: method === "CARD" ? body.billingDetails : null,
    p_acceptance: acceptance,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : ["23514", "P0002"].includes(error.code) ? 409 : 500;
    return enrollmentJson({
      error: status === 500 ? "Nu am putut salva cumpărarea. Reîncearcă." : error.message,
      ...(KNOWN_CODES.includes(error.details) ? { code: error.details } : {}),
    }, status);
  }
  if (!data?.paymentId) return enrollmentJson({ error: "Nu am putut salva cumpărarea. Reîncearcă." }, 500);
  if (method === "CASH" && data.reused !== true) {
    const channel = db.channel("admin:pending-cash-payments");
    try {
      await channel.send({
        type: "broadcast",
        event: "pending_cash_payment",
        payload: { enrollmentId: target.enrollmentId, sessionCount: quantity, courseId: target.courseId },
      });
    } catch {
      console.error("Cash renewal saved; realtime notification could not be delivered");
    } finally {
      await db.removeChannel(channel).catch(() => undefined);
    }
  }
  const { reused: _reused, sessions: _sessions, ...response } = data;
  return enrollmentJson(response);
}
