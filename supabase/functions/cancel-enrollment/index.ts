// Edge Function: cancel-enrollment
// Replaces: POST /api/enrollments/{id}/cancel

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser, getUserRole } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await getUser(req);
    const role = await getUserRole(user.id);
    if (role !== "PARENT") {
      return new Response(
        JSON.stringify({ error: "Only parents can cancel enrollments" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const { enrollmentId } = await req.json();

    // Get enrollment with child to verify parent ownership
    const { data: enrollment } = await supabaseAdmin
      .from("enrollments")
      .select("*, child:children(parent_id)")
      .eq("id", enrollmentId)
      .single();

    if (!enrollment) {
      return new Response(
        JSON.stringify({ error: "Enrollment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (enrollment.child?.parent_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Not your enrollment" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    if (enrollment.status !== "PENDING") {
      return new Response(
        JSON.stringify({ error: "Can only cancel PENDING enrollments" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Cancel enrollment
    await supabaseAdmin
      .from("enrollments")
      .update({
        status: "CANCELLED",
        purchased_sessions: 0,
        remaining_sessions: 0,
        sessions_used: 0,
      })
      .eq("id", enrollmentId);

    // Void associated card payment
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, method")
      .eq("enrollment_id", enrollmentId)
      .single();

    if (payment?.method === "CARD") {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "FAILED",
          gateway_txn_id: null,
          client_secret: null,
          paid_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
