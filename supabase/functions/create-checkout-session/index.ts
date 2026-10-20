import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getUser, supabaseAdmin } from "../_shared/supabase.ts";
import { authorizedRonCharge } from "../_shared/payment-charge.ts";
import { paymentRecipient } from "../_shared/payment-recipient.ts";
import { MAX_CHECKOUT_LINES, prepareCheckoutSession } from "../_shared/checkout-session.ts";
import { enrollmentJson } from "../_shared/enrollment-pricing.ts";
import { stripeReturnBase } from "../_shared/stripe-return-url.ts";
import { withCors } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";

const OFFER_TABLE: Record<string, { table: string; column: string }> = {
  COURSE: { table: "courses", column: "name" },
  ACTIVITY: { table: "activities", column: "name" },
  CAMP: { table: "camps", column: "title" },
  COMPETITION: { table: "competitions", column: "title" },
};

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
    const user = await getUser(req);
    const body = await req.json().catch(() => null);
    const ids = Array.isArray(body?.enrollmentIds)
      ? [...new Set(body.enrollmentIds.filter((id: unknown): id is string => typeof id === "string"))]
      : [];
    if (!ids.length || ids.length > MAX_CHECKOUT_LINES) {
      return enrollmentJson({ error: "Alege între 1 și 10 înscrieri de plătit." }, 400);
    }

    const { data: enrollments, error: enrollmentError } = await supabaseAdmin
      .from("enrollments")
      .select("*, child:children(name)")
      .in("id", ids);
    const { data: payments, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .in("enrollment_id", ids);
    if (enrollmentError || paymentError || enrollments?.length !== ids.length) {
      return enrollmentJson({ error: "Înscrierea nu este disponibilă în acest cont." }, 404);
    }

    const offers = new Set(enrollments.map((row) => `${row.kind}:${row.entity_id}`));
    if (offers.size !== 1) {
      return enrollmentJson({ error: "Plătește separat înscrierile la oferte diferite." }, 409);
    }
    const first = enrollments[0];
    const offer = OFFER_TABLE[first.kind];
    if (!offer) return enrollmentJson({ error: "Tipul înscrierii nu permite plata cu cardul." }, 409);
    const { data: entity } = await supabaseAdmin
      .from(offer.table)
      .select(offer.column)
      .eq("id", first.entity_id)
      .single();
    const title = (entity as Record<string, string> | null)?.[offer.column] ?? "Înscriere";

    const lines = [];
    for (const enrollment of enrollments) {
      const rows = payments?.filter((row) => row.enrollment_id === enrollment.id) ?? [];
      const payment = rows[0];
      if (rows.length !== 1 || payment.method !== "CARD") {
        return enrollmentJson({ error: "Înscrierea nu are o plată cu cardul de reluat." }, 409);
      }
      await authorizedRonCharge(supabaseAdmin, user.id, enrollment, payment);
      const participant = (enrollment.child as { name?: string } | null)?.name ?? payment.billing_name ?? "Participant";
      lines.push({
        paymentId: payment.id,
        enrollmentId: enrollment.id,
        amount: payment.amount,
        status: payment.status,
        gatewayId: payment.gateway_txn_id,
        name: `${title} · ${participant}`,
        email: payment.billing_email as string | null,
      });
    }

    const recipient = await paymentRecipient(supabaseAdmin, first);
    const prepared = await prepareCheckoutSession(supabaseAdmin, getStripe(), {
      lines,
      destination: recipient.accountId,
      customerEmail: lines.find((line) => line.email)?.email ?? null,
      returnBase: stripeReturnBase(req.headers.get("origin"), Deno.env.get("FRONTEND_URL")),
    });
    return enrollmentJson(prepared, 200);
  }),
);
