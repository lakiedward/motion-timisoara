// Edge Function: mark-cash-paid
// Replaces: POST /api/payments/{id}/mark-paid and POST /api/coach/payments/{id}/mark-paid
// Handles: Coach/admin marks cash payment as received, activates enrollment

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
    const { paymentId } = await req.json();

    // Get payment with enrollment
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("*, enrollment:enrollments(*)")
      .eq("id", paymentId)
      .single();

    if (!payment) {
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (payment.method !== "CASH") {
      return new Response(
        JSON.stringify({ error: "Only cash payments can be marked as paid" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate coach ownership if not admin
    if (role === "COACH") {
      const enrollment = payment.enrollment;
      if (enrollment.kind === "COURSE") {
        const { data: course } = await supabaseAdmin
          .from("courses")
          .select("coach_id")
          .eq("id", enrollment.entity_id)
          .single();
        if (course?.coach_id !== user.id) {
          return new Response(
            JSON.stringify({
              error: "Coach can only mark payments for their own courses",
            }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }
      } else if (enrollment.kind === "ACTIVITY") {
        const { data: activity } = await supabaseAdmin
          .from("activities")
          .select("coach_id")
          .eq("id", enrollment.entity_id)
          .single();
        if (activity?.coach_id !== user.id) {
          return new Response(
            JSON.stringify({
              error: "Coach can only mark payments for their own activities",
            }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            error:
              "Coach can only mark payments for course or activity enrollments",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    } else if (role !== "ADMIN") {
      return new Response(
        JSON.stringify({ error: "Not authorized" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();

    // Update payment
    await supabaseAdmin
      .from("payments")
      .update({
        status: "SUCCEEDED",
        updated_at: now,
        paid_at: now,
      })
      .eq("id", paymentId);

    // Activate enrollment and credit sessions
    const enrollment = payment.enrollment;
    const enrollUpdate: any = { status: "ACTIVE" };

    if (enrollment.kind === "COURSE") {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("price_per_session")
        .eq("id", enrollment.entity_id)
        .single();

      if (course && course.price_per_session > 0) {
        const sessionsAdded = Math.floor(
          payment.amount / course.price_per_session,
        );
        if (sessionsAdded > 0) {
          enrollUpdate.purchased_sessions = enrollment.purchased_sessions +
            sessionsAdded;
          enrollUpdate.remaining_sessions = enrollment.remaining_sessions +
            sessionsAdded;

          // Notify session purchase
          await supabaseAdmin.channel("admin:session-purchases").send({
            type: "broadcast",
            event: "session_purchase",
            payload: {
              enrollmentId: enrollment.id,
              sessionCount: sessionsAdded,
              courseId: enrollment.entity_id,
            },
          });
        }
      }
    }

    await supabaseAdmin
      .from("enrollments")
      .update(enrollUpdate)
      .eq("id", enrollment.id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
