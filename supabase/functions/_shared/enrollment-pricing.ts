import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPriceSnapshot, readPriceSnapshot, type PriceSnapshot } from "./price-snapshot.ts";

export interface EnrollmentServices {
  db: SupabaseClient;
  getUser: (req: Request) => Promise<{ id: string }>;
  getUserRole: (id: string) => Promise<string | null>;
}

export interface ExistingEnrollment {
  id: string;
  child_id: string;
  status: string;
}

export interface EnrollmentPayment {
  id: string;
  enrollment_id: string;
  amount: number;
  currency: string;
  status: string;
  gateway_txn_id: string | null;
  pricing_snapshot?: PriceSnapshot | null;
}

export interface EnrollmentChildPrice {
  childId: string;
  amount?: number;
  currency?: string;
  priceVersion?: string;
  reason?: string;
  payment?: EnrollmentPayment;
  snapshot?: PriceSnapshot;
}

export interface EnrollmentOffer {
  currency: string;
  eur_ron_rate_micros?: number | null;
  price?: number;
  price_per_session?: number;
}

export function enrollmentJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function validSelection(kind: unknown, entityId: unknown, childIds: unknown): childIds is string[] {
  return ["CAMP", "COURSE", "ACTIVITY"].includes(String(kind)) &&
    typeof entityId === "string" && entityId.length > 0 &&
    Array.isArray(childIds) && childIds.length > 0 &&
    childIds.every((id) => typeof id === "string" && id.length > 0) &&
    new Set(childIds).size === childIds.length;
}

async function priceVersion(campId: string, childId: string, amount: number, currency: string) {
  const bytes = new TextEncoder().encode(JSON.stringify([campId, childId, amount, currency]));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getEnrollmentChildPrices(
  db: SupabaseClient,
  kind: PriceSnapshot["kind"],
  entityId: string,
  childIds: string[],
  offer: EnrollmentOffer,
  existing: ExistingEnrollment[],
  quantity: number,
): Promise<EnrollmentChildPrice[]> {
  const pendingIds = existing.filter((row) => row.status === "PENDING").map((row) => row.id);
  let payments: EnrollmentPayment[] = [];
  if (pendingIds.length) {
    const result = await db.from("payments")
      .select("id, enrollment_id, amount, currency, status, gateway_txn_id, pricing_snapshot")
      .in("enrollment_id", pendingIds);
    if (result.error) throw enrollmentJson({ error: "Nu am putut verifica plățile existente." }, 500);
    payments = result.data ?? [];
  }

  return await Promise.all(childIds.map(async (childId) => {
    const enrollments = existing.filter((row) => row.child_id === childId);
    if (enrollments.some((row) => row.status === "ACTIVE")) {
      return { childId, reason: "Deja înscris" };
    }
    const childPayments = payments.filter((row) => enrollments.some((enrollment) => enrollment.id === row.enrollment_id));
    if (childPayments.length > 1 || enrollments.length > 1) {
      return { childId, reason: "Înscrierea are nevoie de verificare. Contactează clubul." };
    }
    const payment = childPayments[0];
    if (payment && !["PENDING", "FAILED", "CANCELLED"].includes(payment.status)) {
      return { childId, reason: "Plata a fost deja procesată. Verifică în Înscrieri." };
    }

    if (payment?.pricing_snapshot) {
      let snapshot: PriceSnapshot;
      try {
        snapshot = await readPriceSnapshot(payment.pricing_snapshot);
      } catch {
        throw enrollmentJson({ error: "Oferta salvată nu este validă. Contactează clubul." }, 500);
      }
      if (snapshot.kind !== kind || snapshot.entityId !== entityId || snapshot.childId !== childId ||
        snapshot.amount !== payment.amount || snapshot.currency !== payment.currency) {
        throw enrollmentJson({ error: "Oferta salvată nu corespunde înscrierii." }, 500);
      }
      if (snapshot.quantity !== quantity) return { childId, reason: "Pachetul salvat diferă. Reia plata cu numărul de ședințe confirmat inițial." };
      return { childId, amount: snapshot.amount, currency: snapshot.currency, priceVersion: snapshot.priceVersion, payment, snapshot };
    }
    if (payment?.gateway_txn_id) {
      if (!Number.isSafeInteger(payment.amount) || payment.amount < 0 || payment.currency !== "RON") {
        throw enrollmentJson({ error: "Plata existentă nu este în lei sau suma nu este validă. Contactează clubul." }, 409);
      }
      return { childId, amount: payment.amount, currency: "RON", payment,
        priceVersion: await priceVersion(`${kind}:${entityId}:${payment.id}`, childId, payment.amount, payment.currency) };
    }
    let sourceAmount = kind === "COURSE" ? offer.price_per_session : offer.price;
    if (kind === "CAMP") {
      const result = await db.rpc("pret_tabara_pentru_copil", { p_camp_id: entityId, p_child_id: childId });
      if (result.error) throw enrollmentJson({ error: "Nu am putut calcula prețul taberei. Încearcă din nou." }, 500);
      if (result.data === null) {
        return { childId, reason: "Nu există o categorie de preț pentru vârsta copilului la începutul taberei." };
      }
      sourceAmount = result.data;
    }
    try {
      const snapshot = await createPriceSnapshot(kind, entityId, childId, sourceAmount!, offer.currency,
        offer.eur_ron_rate_micros ?? null, quantity);
      return { childId, amount: snapshot.amount, currency: snapshot.currency, priceVersion: snapshot.priceVersion, payment, snapshot };
    } catch {
      throw enrollmentJson({ error: "Prețul sau cursul valutar nu este valid. Contactează clubul." }, 500);
    }
  }));
}
