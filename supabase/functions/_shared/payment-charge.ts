import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";
import { readPriceSnapshot } from "./price-snapshot.ts";

export async function authorizedRonCharge(
  db: SupabaseClient,
  userId: string,
  enrollment: {
    id?: string;
    kind: string;
    entity_id: string;
    child_id: string | null;
    adult_profile_id?: string | null;
    status: string;
  },
  payment: {
    amount: number;
    currency: string;
    status: string;
    gateway_txn_id?: string | null;
    pricing_snapshot?: unknown;
  },
): Promise<number> {
  const childEnrollment = Boolean(enrollment.child_id) &&
    !enrollment.adult_profile_id;
  const adultEnrollment = !enrollment.child_id &&
    enrollment.adult_profile_id === userId &&
    ["CAMP", "COMPETITION"].includes(enrollment.kind);
  if (childEnrollment) {
    const { data: child, error } = await db
      .from("children")
      .select("parent_id")
      .eq("id", enrollment.child_id)
      .single();
    if (error || !child || child.parent_id !== userId) {
      throw enrollmentJson({ error: "Înscrierea nu îți aparține." }, 403);
    }
  } else if (!adultEnrollment) {
    throw enrollmentJson({ error: "Înscrierea nu îți aparține." }, 403);
  }
  if (enrollment.status !== "PENDING" && enrollment.status !== "ACTIVE") {
    throw enrollmentJson(
      { error: "Înscrierea nu mai permite plata. Verifică în Înscrieri." },
      409,
    );
  }
  const canInspectSucceeded = payment.status === "SUCCEEDED" &&
    Boolean(payment.gateway_txn_id);
  if (
    (!canInspectSucceeded && !["PENDING", "FAILED"].includes(payment.status)) ||
    payment.currency !== "RON" ||
    !Number.isSafeInteger(payment.amount) ||
    payment.amount <= 0 ||
    payment.amount > 99999999
  ) {
    throw enrollmentJson(
      {
        error:
          "Plata nu poate fi inițiată. Verifică suma în lei și starea înscrierii.",
      },
      409,
    );
  }
  if (enrollment.kind === "COMPETITION" && payment.pricing_snapshot == null) {
    throw enrollmentJson(
      {
        error: "Oferta concursului nu este salvată. Contactează organizatorul.",
      },
      409,
    );
  }
  if (payment.pricing_snapshot != null) {
    try {
      const snapshot = await readPriceSnapshot(payment.pricing_snapshot);
      if (
        snapshot.kind !== enrollment.kind ||
        snapshot.entityId !== enrollment.entity_id ||
        snapshot.childId !== enrollment.child_id ||
        (snapshot.adultProfileId ?? null) !==
          (enrollment.adult_profile_id ?? null) ||
        snapshot.amount !== payment.amount
      ) {
        throw new Error("Mismatched snapshot");
      }
      if (enrollment.kind === "COMPETITION") {
        if (!enrollment.id || snapshot.schemaVersion !== 2) {
          throw new Error("Missing competition enrollment");
        }
        const { data: registration, error: registrationError } = await db
          .from("competition_registrations")
          .select(
            "competition_id,category_id,route_id,gpx_storage_path_snapshot,accepted_price_bani,adult_profile_id,adult_birth_date",
          )
          .eq("enrollment_id", enrollment.id)
          .single();
        if (
          registrationError ||
          !registration ||
          registration.competition_id !== enrollment.entity_id ||
          registration.category_id !== snapshot.categoryId ||
          registration.route_id !== snapshot.routeId ||
          registration.gpx_storage_path_snapshot !== snapshot.gpxStoragePath ||
          (registration.adult_profile_id ?? null) !==
            (snapshot.adultProfileId ?? null) ||
          (registration.adult_birth_date ?? null) !==
            (snapshot.adultBirthDate ?? null) ||
          registration.accepted_price_bani !== payment.amount
        ) {
          throw new Error("Mismatched competition registration");
        }
      }
    } catch {
      throw enrollmentJson(
        { error: "Oferta salvată nu este validă. Contactează clubul." },
        409,
      );
    }
  }
  return payment.amount;
}
