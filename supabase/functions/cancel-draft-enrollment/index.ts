// Edge Function: cancel-draft-enrollment
// Rollback path for the checkout wizard. When card confirmation fails (or the
// user abandons after the enrollment rows were already written), this removes
// the PENDING draft(s) and their unpaid payment rows so the seat is released
// and the child is not left with a phantom enrollment.
//
// Deliberately narrow: only PENDING enrollments owned by the caller, and only
// when no payment has succeeded. Cancelling an ACTIVE enrollment (with the
// refund that implies) has no handler yet.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";
import { cancelOpenPaymentIntent, getStripe } from "../_shared/stripe.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const user = await getUser(req);
    const body = await req.json();

    // Accept a single id or a batch — multi-child checkout creates one row per child.
    const ids: string[] = body.enrollmentIds ?? (body.enrollmentId ? [body.enrollmentId] : []);
    if (!ids.length) return json({ error: "enrollmentId or enrollmentIds is required" }, 400);

    const { data: enrollments, error } = await supabaseAdmin
      .from("enrollments")
      .select("id, status, child:children(parent_id)")
      .in("id", ids);
    if (error) return json({ error: "Failed to load enrollments" }, 500);

    const cancelled: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const enrollment of enrollments ?? []) {
      const parentId = (enrollment.child as { parent_id: string } | null)?.parent_id;
      if (parentId !== user.id) {
        skipped.push({ id: enrollment.id, reason: "not_owner" });
        continue;
      }
      if (enrollment.status !== "PENDING") {
        skipped.push({ id: enrollment.id, reason: `status_${enrollment.status}` });
        continue;
      }

      // Never delete a draft whose money already moved (local or Stripe).
      const { data: payments } = await supabaseAdmin
        .from("payments")
        .select("id, status, gateway_txn_id")
        .eq("enrollment_id", enrollment.id);

      if (payments?.some((p) => p.status === "SUCCEEDED")) {
        skipped.push({ id: enrollment.id, reason: "payment_succeeded" });
        continue;
      }

      let stripeAlreadyPaid = false;
      for (const payment of payments ?? []) {
        if (!payment.gateway_txn_id) continue;
        try {
          const existing = await getStripe().paymentIntents.retrieve(payment.gateway_txn_id);
          if (existing.status === "succeeded") {
            stripeAlreadyPaid = true;
            break;
          }
        } catch (err) {
          console.error("Failed to inspect PaymentIntent before draft cancel:", payment.gateway_txn_id, err);
        }
      }
      if (stripeAlreadyPaid) {
        skipped.push({ id: enrollment.id, reason: "stripe_succeeded" });
        continue;
      }

      // Cancel any open Stripe intents before deleting rows — otherwise an old
      // client_secret can still be confirmed after the draft is gone.
      for (const payment of payments ?? []) {
        await cancelOpenPaymentIntent(payment.gateway_txn_id);
      }

      await supabaseAdmin.from("payments").delete().eq("enrollment_id", enrollment.id);
      const { error: delErr } = await supabaseAdmin
        .from("enrollments")
        .delete()
        .eq("id", enrollment.id);

      if (delErr) {
        skipped.push({ id: enrollment.id, reason: "delete_failed" });
        continue;
      }
      cancelled.push(enrollment.id);
    }

    return json({ success: true, cancelled, skipped });
  }),
);
