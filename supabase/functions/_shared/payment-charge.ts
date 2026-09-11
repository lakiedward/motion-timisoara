import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";
import { readPriceSnapshot } from "./price-snapshot.ts";

export async function authorizedRonCharge(
  db: SupabaseClient, userId: string,
  enrollment: { kind: string; entity_id: string; child_id: string },
  payment: { amount: number; currency: string; status: string; gateway_txn_id?: string | null; pricing_snapshot?: unknown },
): Promise<number> {
  const { data: child, error } = await db.from("children").select("parent_id").eq("id", enrollment.child_id).single();
  if (error || !child || child.parent_id !== userId) {
    throw enrollmentJson({ error: "Înscrierea nu îți aparține." }, 403);
  }
  const canInspectSucceeded = payment.status === "SUCCEEDED" && Boolean(payment.gateway_txn_id);
  if ((!canInspectSucceeded && !["PENDING", "FAILED"].includes(payment.status)) || payment.currency !== "RON" ||
    !Number.isSafeInteger(payment.amount) || payment.amount <= 0 || payment.amount > 99999999) {
    throw enrollmentJson({ error: "Plata nu poate fi inițiată. Verifică suma în lei și starea înscrierii." }, 409);
  }
  if (payment.pricing_snapshot != null) {
    try {
      const snapshot = await readPriceSnapshot(payment.pricing_snapshot);
      if (snapshot.kind !== enrollment.kind || snapshot.entityId !== enrollment.entity_id ||
        snapshot.childId !== enrollment.child_id || snapshot.amount !== payment.amount) throw new Error("Mismatched snapshot");
    } catch {
      throw enrollmentJson({ error: "Oferta salvată nu este validă. Contactează clubul." }, 409);
    }
  }
  return payment.amount;
}
