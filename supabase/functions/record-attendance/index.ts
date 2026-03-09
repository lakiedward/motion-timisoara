// Edge Function: record-attendance
// Replaces: CoachAttendanceController
// Handles: marking attendance with session deduction logic

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
    if (!["COACH", "ADMIN"].includes(role ?? "")) {
      return new Response(
        JSON.stringify({ error: "Not authorized" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const { occurrenceId, childId, status } = await req.json();

    // Validate occurrence belongs to coach's course (if COACH role)
    const { data: occurrence } = await supabaseAdmin
      .from("course_occurrences")
      .select("id, course:courses(id, coach_id)")
      .eq("id", occurrenceId)
      .single();

    if (!occurrence) {
      return new Response(
        JSON.stringify({ error: "Occurrence not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (role === "COACH" && occurrence.course?.coach_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Not your course" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get existing attendance record
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id, status")
      .eq("occurrence_id", occurrenceId)
      .eq("child_id", childId)
      .single();

    const previousStatus = existing?.status ?? null;

    // Get enrollment for session management
    const { data: enrollment } = await supabaseAdmin
      .from("enrollments")
      .select("id, remaining_sessions, sessions_used, kind")
      .eq("kind", "COURSE")
      .eq("entity_id", occurrence.course?.id)
      .eq("child_id", childId)
      .eq("status", "ACTIVE")
      .single();

    // Session deduction logic (symmetric)
    if (enrollment) {
      if (status === "PRESENT" && previousStatus !== "PRESENT") {
        // Deduct a session
        if (enrollment.remaining_sessions <= 0) {
          return new Response(
            JSON.stringify({ error: "No remaining sessions" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        await supabaseAdmin
          .from("enrollments")
          .update({
            remaining_sessions: enrollment.remaining_sessions - 1,
            sessions_used: enrollment.sessions_used + 1,
          })
          .eq("id", enrollment.id);
      } else if (status === "ABSENT" && previousStatus === "PRESENT") {
        // Restore a session
        await supabaseAdmin
          .from("enrollments")
          .update({
            remaining_sessions: enrollment.remaining_sessions + 1,
            sessions_used: enrollment.sessions_used - 1,
          })
          .eq("id", enrollment.id);
      }
    }

    // Upsert attendance record
    if (existing) {
      await supabaseAdmin
        .from("attendance")
        .update({ status })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("attendance")
        .insert({
          occurrence_id: occurrenceId,
          child_id: childId,
          status,
        });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
