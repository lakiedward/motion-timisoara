import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PaymentCompletion {
  changed: boolean;
  status: string;
  enrollmentId: string;
  sessionsAdded: number;
}

export async function applyPaymentResult(db: SupabaseClient, input: {
  paymentId: string;
  result: "SUCCEEDED" | "FAILED";
  amount: number;
  currency: string;
  method: "CASH" | "CARD";
  gatewayId: string | null;
}): Promise<PaymentCompletion> {
  const { data, error } = await db.rpc("apply_enrollment_payment_result", {
    p_payment_id: input.paymentId,
    p_result: input.result,
    p_amount: input.amount,
    p_currency: input.currency,
    p_method: input.method,
    p_gateway_id: input.gatewayId,
  });
  if (error || !data || typeof data.changed !== "boolean" || typeof data.sessionsAdded !== "number") {
    throw new Error("Nu am putut confirma plata. Încearcă din nou.");
  }
  return data;
}

export async function notifyPaymentResult(db: SupabaseClient, result: PaymentCompletion, failureReason?: string) {
  if (!result.changed) return;
  try {
    const { data: enrollment, error } = await db.from("enrollments")
      .select("id, entity_id, child:children(parent_id)").eq("id", result.enrollmentId).single();
    if (error || !enrollment) return;
    const broadcast = async (name: string, event: string, payload: Record<string, unknown>) => {
      const channel = db.channel(name);
      try {
        await channel.send({ type: "broadcast", event, payload });
      } finally {
        await db.removeChannel(channel);
      }
    };
    if (result.sessionsAdded > 0) {
      await broadcast("admin:session-purchases", "session_purchase", {
        enrollmentId: result.enrollmentId, sessionCount: result.sessionsAdded, courseId: enrollment.entity_id,
      });
    }
    const child = enrollment.child as unknown as { parent_id: string } | null;
    if (child?.parent_id) {
      await broadcast(`user:${child.parent_id}:payments`, result.status === "SUCCEEDED" ? "enrollment_ready" : "payment_failed",
        result.status === "SUCCEEDED"
          ? { enrollmentId: result.enrollmentId, status: "ACTIVE" }
          : { enrollmentId: result.enrollmentId, reason: failureReason ?? "Plata a eșuat. Poți încerca din nou." });
    }
  } catch {
    console.error("Payment saved; realtime notification could not be delivered");
  }
}
