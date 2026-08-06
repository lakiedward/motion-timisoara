// Edge Function: cancel-draft-enrollment
// Rollback path for the checkout wizard. When card confirmation fails (or the
// user abandons after the enrollment rows were already written), this removes
// the PENDING draft(s) and their unpaid payment rows so the seat is released
// and the child is not left with a phantom enrollment.
//
// Deliberately narrow: only PENDING enrollments owned by the caller, and only
// when no payment has succeeded. Anything else is a job for cancel-enrollment.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";

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

      // Never delete a draft whose money already moved.
      const { data: payments } = await supabaseAdmin
        .from("payments")
        .select("id, status")
        .eq("enrollment_id", enrollment.id);

      if (payments?.some((p) => p.status === "SUCCEEDED")) {
        skipped.push({ id: enrollment.id, reason: "payment_succeeded" });
        continue;
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
