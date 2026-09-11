import { enrollmentJson, type EnrollmentServices } from "../_shared/enrollment-pricing.ts";
import { applyPaymentResult, notifyPaymentResult } from "../_shared/payment-completion.ts";

export function cashPaymentHandler({ db, getUser, getUserRole }: EnrollmentServices) {
  return async (req: Request) => {
    if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
    const user = await getUser(req);
    const role = await getUserRole(user.id);
    if (!["COACH", "CLUB", "ADMIN"].includes(role ?? "")) return enrollmentJson({ error: "Nu ai acces la confirmarea plăților." }, 403);
    const { paymentId } = await req.json();
    if (typeof paymentId !== "string" || !paymentId) return enrollmentJson({ error: "Plata nu este validă." }, 400);
    const { data: payment, error } = await db.from("payments")
      .select("id, amount, currency, method, enrollment:enrollments(kind, entity_id)").eq("id", paymentId).single();
    if (error || !payment) return enrollmentJson({ error: "Nu am putut găsi plata." }, 404);
    if (payment.method !== "CASH") return enrollmentJson({ error: "Poți confirma aici doar plățile cash." }, 400);
    const enrollment = payment.enrollment as unknown as { kind: string; entity_id: string } | null;
    if (!enrollment) return enrollmentJson({ error: "Înscrierea nu a fost găsită." }, 404);
    if (role !== "ADMIN") {
      const table = { COURSE: "courses", ACTIVITY: "activities", CAMP: "camps" }[enrollment.kind];
      if (!table) return enrollmentJson({ error: "Tip de înscriere necunoscut." }, 400);
      const { data: offer, error: offerError } = await db.from(table).select("coach_id, club_id")
        .eq("id", enrollment.entity_id).single();
      if (offerError) return enrollmentJson({ error: "Nu am putut verifica organizatorul." }, 503);
      let owned = role === "COACH" && offer?.coach_id === user.id;
      if (role === "CLUB" && offer?.club_id) {
        const { data: club, error: clubError } = await db.from("clubs").select("owner_user_id").eq("id", offer.club_id).single();
        if (clubError) return enrollmentJson({ error: "Nu am putut verifica organizatorul." }, 503);
        owned = club?.owner_user_id === user.id;
      }
      if (!owned) return enrollmentJson({ error: "Poți confirma doar plățile ofertelor tale." }, 403);
    }
    const result = await applyPaymentResult(db, {
      paymentId, result: "SUCCEEDED", amount: payment.amount, currency: payment.currency, method: "CASH", gatewayId: null,
    });
    if (result.status !== "SUCCEEDED") return enrollmentJson({ error: "Plata nu mai poate fi confirmată." }, 409);
    await notifyPaymentResult(db, result);
    return enrollmentJson({ success: true });
  };
}
