import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

export interface CampChildPrice {
  childId: string;
  amount?: number;
  currency?: string;
  priceVersion?: string;
  reason?: string;
  payment?: EnrollmentPayment;
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

export async function getCampChildPrices(
  db: SupabaseClient,
  campId: string,
  childIds: string[],
  currency: string,
  existing: ExistingEnrollment[],
): Promise<CampChildPrice[]> {
  const pendingIds = existing.filter((row) => row.status === "PENDING").map((row) => row.id);
  let payments: EnrollmentPayment[] = [];
  if (pendingIds.length) {
    const result = await db.from("payments")
      .select("id, enrollment_id, amount, currency, status, gateway_txn_id")
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

    let amount: number;
    let effectiveCurrency = currency;
    if (payment?.gateway_txn_id) {
      amount = payment.amount;
      effectiveCurrency = payment.currency;
    } else {
      const result = await db.rpc("pret_tabara_pentru_copil", { p_camp_id: campId, p_child_id: childId });
      if (result.error) throw enrollmentJson({ error: "Nu am putut calcula prețul taberei. Încearcă din nou." }, 500);
      if (result.data === null) {
        return { childId, reason: "Nu există o categorie de preț pentru vârsta copilului la începutul taberei." };
      }
      amount = result.data;
    }
    if (!Number.isSafeInteger(amount) || amount < 0 || effectiveCurrency !== "RON") {
      throw enrollmentJson({ error: "Prețul taberei nu este disponibil. Contactează clubul." }, 500);
    }
    return { childId, amount, currency: effectiveCurrency, priceVersion: await priceVersion(campId, childId, amount, effectiveCurrency), payment };
  }));
}
