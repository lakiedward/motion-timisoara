import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson, type EnrollmentChildPrice, type ExistingEnrollment } from "../_shared/enrollment-pricing.ts";
import { readPriceSnapshot, type PriceSnapshot } from "../_shared/price-snapshot.ts";

export async function completedEnrollmentPrices(
  db: SupabaseClient, kind: PriceSnapshot["kind"], entityId: string,
  existing: ExistingEnrollment[], quantity: number,
): Promise<EnrollmentChildPrice[]> {
  const active = existing.filter((row) => row.status === "ACTIVE");
  if (!active.length) return [];
  const result = await db.from("payments").select("enrollment_id,method,status,gateway_txn_id,amount,currency,pricing_snapshot")
    .in("enrollment_id", active.map((row) => row.id));
  if (result.error) throw enrollmentJson({ error: "Nu am putut verifica înscrierile deja plătite." }, 500);
  return await Promise.all(active.map(async (enrollment) => {
    const payments = result.data?.filter((row) => row.enrollment_id === enrollment.id) ?? [];
    const payment = payments[0];
    const free = payment?.amount === 0;
    if (payments.length !== 1 || payment.status !== "SUCCEEDED" || !payment.pricing_snapshot ||
      (!free && (payment.method !== "CARD" || !payment.gateway_txn_id))) {
      throw enrollmentJson({ error: "Înscrierea este deja procesată. Verifică în Înscrieri." }, 409);
    }
    let snapshot: PriceSnapshot;
    try {
      snapshot = await readPriceSnapshot(payment.pricing_snapshot);
    } catch {
      throw enrollmentJson({ error: "Oferta salvată nu este validă. Contactează clubul." }, 409);
    }
    if (snapshot.kind !== kind || snapshot.entityId !== entityId ||
      (enrollment.child_id
        ? snapshot.childId !== enrollment.child_id
        : snapshot.adultProfileId !== enrollment.adult_profile_id) ||
      snapshot.quantity !== quantity || snapshot.amount !== payment.amount || payment.currency !== "RON") {
      throw enrollmentJson({ error: "Înscrierea este deja procesată. Verifică în Înscrieri." }, 409);
    }
    return enrollment.child_id
      ? { childId: enrollment.child_id, amount: snapshot.amount, currency: "RON", priceVersion: snapshot.priceVersion, snapshot }
      : { adultProfileId: enrollment.adult_profile_id ?? undefined, amount: snapshot.amount, currency: "RON", priceVersion: snapshot.priceVersion, snapshot };
  }));
}

interface SaveBatchInput {
  parentId: string;
  kind: PriceSnapshot["kind"];
  entityId: string;
  paymentMethod: "CARD" | "CASH";
  quotes: EnrollmentChildPrice[];
  billingDetails?: Record<string, string>;
}

interface SavedBatch {
  enrollmentId: string;
  enrollmentIds: string[];
  createdEnrollmentIds: string[];
  prices: { childId?: string; adultProfileId?: string; amount: number; currency: string }[];
  requiresPaymentIntent: boolean;
}

export async function saveEnrollmentBatch(db: SupabaseClient, input: SaveBatchInput): Promise<SavedBatch> {
  const { data, error } = await db.rpc("save_enrollment_batch", {
    p_parent_id: input.parentId, p_kind: input.kind, p_entity_id: input.entityId, p_method: input.paymentMethod,
    p_quotes: input.quotes.map((quote) => ({
      childId: quote.childId ?? null,
      adultProfileId: quote.adultProfileId ?? null,
      amount: quote.amount,
      currency: quote.currency,
      priceVersion: quote.priceVersion,
      snapshot: quote.snapshot ?? null,
    })),
    p_billing: input.billingDetails ?? null,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 400 : ["23514", "P0002"].includes(error.code) ? 409 : 500;
    throw enrollmentJson({
      error: status === 500 ? "Nu am putut salva înscrierile. Reîncearcă." : error.message,
      ...(error.details === "PRICE_CHANGED" ? { code: "PRICE_CHANGED" } : {}),
    }, status);
  }
  if (!data?.enrollmentIds?.length) throw enrollmentJson({ error: "Nu s-au creat înscrieri. Reîncearcă." }, 500);
  return data as SavedBatch;
}

export async function notifyCashEnrollments(db: SupabaseClient, batch: SavedBatch, input: {
  kind: PriceSnapshot["kind"]; entityId: string; sessionPackageSize: number; children: { id: string; name: string }[];
}) {
  if (input.kind === "CAMP") return;
  const course = input.kind === "COURSE";
  for (const enrollmentId of batch.createdEnrollmentIds) {
    const channel = db.channel(course ? "admin:pending-cash-payments" : "admin:pending-activity-payments");
    try {
      const index = batch.enrollmentIds.indexOf(enrollmentId);
      await channel.send({ type: "broadcast", event: course ? "pending_cash_payment" : "pending_activity_payment", payload: course
        ? { enrollmentId, sessionCount: input.sessionPackageSize, courseId: input.entityId }
        : { enrollmentId, activityId: input.entityId, childName: input.children.find((child) => child.id === batch.prices[index]?.childId)?.name } });
    } catch {
      console.error("Cash enrollment saved; realtime notification could not be delivered");
    } finally {
      await db.removeChannel(channel).catch(() => undefined);
    }
  }
}
