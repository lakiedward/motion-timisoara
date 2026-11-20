import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";
import { createCoursePackageSnapshot, createPriceSnapshot, type PriceSnapshot, validQuantity } from "./price-snapshot.ts";
import type { CourseChoice } from "./course-package.ts";
import { OPEN_PAYMENT_STATUSES } from "./payment-current.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OpenRenewalPayment {
  id: string;
  method: "CARD" | "CASH";
  status: string;
  amount: number;
  sessions: number | null;
  started: boolean;
}

export interface RenewalTarget {
  enrollmentId: string;
  childId: string;
  childName: string;
  courseId: string;
  remainingSessions: number;
  course: { price_per_session: number; currency: string; eur_ron_rate_micros: number | null };
  openPayment: OpenRenewalPayment | null;
}

export interface RenewalQuote {
  amount: number;
  currency: "RON";
  priceVersion: string;
  snapshot: PriceSnapshot;
}

export const MAX_RENEWAL_SESSIONS = 100;

export function validRenewalRequest(enrollmentId: unknown, quantity: unknown): enrollmentId is string {
  return typeof enrollmentId === "string" && UUID.test(enrollmentId) && validQuantity(quantity) &&
    quantity <= MAX_RENEWAL_SESSIONS;
}

export async function loadRenewalTarget(
  db: SupabaseClient,
  parentId: string,
  enrollmentId: string,
): Promise<RenewalTarget> {
  const { data: enrollment, error } = await db
    .from("enrollments")
    .select("id, kind, entity_id, child_id, status, remaining_sessions, child:children(id, name, parent_id)")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (error) throw enrollmentJson({ error: "Nu am putut verifica înscrierea. Reîncearcă." }, 500);
  const child = enrollment?.child as unknown as { id: string; name: string; parent_id: string } | null;
  if (!enrollment || enrollment.kind !== "COURSE" || !enrollment.child_id || !child) {
    throw enrollmentJson({ error: "Înscrierea nu a fost găsită." }, 404);
  }
  if (child.parent_id !== parentId) throw enrollmentJson({ error: "Copilul nu îți aparține" }, 403);
  if (enrollment.status !== "ACTIVE") {
    throw enrollmentJson({ error: "Poți cumpăra ședințe noi doar la o înscriere activă." }, 409);
  }
  const { data: course, error: courseError } = await db
    .from("courses")
    .select("price_per_session, currency, eur_ron_rate_micros, active")
    .eq("id", enrollment.entity_id)
    .maybeSingle();
  if (courseError) throw enrollmentJson({ error: "Nu am putut citi cursul. Reîncearcă." }, 500);
  if (!course) throw enrollmentJson({ error: "Cursul nu a fost găsit." }, 404);
  if (!course.active) throw enrollmentJson({ error: "Cursul nu mai primește înscrieri." }, 409);
  const { data: open, error: paymentError } = await db
    .from("payments")
    .select("id, method, status, amount, gateway_txn_id, pricing_snapshot")
    .eq("enrollment_id", enrollment.id)
    .in("status", OPEN_PAYMENT_STATUSES);
  if (paymentError) throw enrollmentJson({ error: "Nu am putut verifica plățile existente." }, 500);
  if ((open ?? []).length > 1) {
    throw enrollmentJson({ error: "Plata are nevoie de verificare. Contactează clubul." }, 409);
  }
  const payment = open?.[0];
  let prepared = false;
  if (payment && !payment.gateway_txn_id) {
    const request = await db.from("payment_intent_requests").select("id").eq("id", payment.id).maybeSingle();
    if (request.error) throw enrollmentJson({ error: "Nu am putut verifica plățile existente." }, 500);
    prepared = Boolean(request.data);
  }
  return {
    enrollmentId: enrollment.id,
    childId: enrollment.child_id,
    childName: child.name,
    courseId: enrollment.entity_id,
    remainingSessions: enrollment.remaining_sessions ?? 0,
    course,
    openPayment: payment
      ? {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        sessions: typeof payment.pricing_snapshot?.quantity === "number" ? payment.pricing_snapshot.quantity : null,
        started: Boolean(payment.gateway_txn_id) || prepared,
      }
      : null,
  };
}

export async function renewalQuote(target: RenewalTarget, choice: CourseChoice): Promise<RenewalQuote> {
  const { quantity, coursePackage } = choice;
  if (
    !coursePackage &&
    (!Number.isSafeInteger(target.course.price_per_session) || target.course.price_per_session <= 0)
  ) {
    throw enrollmentJson({ error: "Cursul nu are un preț pe ședință. Vorbește cu antrenorul." }, 409);
  }
  let snapshot: PriceSnapshot;
  try {
    snapshot = coursePackage
      ? await createCoursePackageSnapshot(
        target.courseId,
        target.childId,
        coursePackage,
        target.course.currency,
        target.course.eur_ron_rate_micros ?? null,
      )
      : await createPriceSnapshot(
      "COURSE",
      target.courseId,
      target.childId,
      target.course.price_per_session,
      target.course.currency,
      target.course.eur_ron_rate_micros ?? null,
      quantity,
    );
  } catch {
    throw enrollmentJson({ error: "Prețul sau cursul valutar nu este valid. Contactează clubul." }, 500);
  }
  return { amount: snapshot.amount, currency: "RON", priceVersion: snapshot.priceVersion, snapshot };
}
