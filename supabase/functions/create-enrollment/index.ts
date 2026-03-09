// Edge Function: create-enrollment
// Replaces: POST /api/enrollments
// Handles: child ownership validation, capacity checks, enrollment + payment creation

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser, getUserRole } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";

interface EnrollmentRequest {
  kind: "COURSE" | "CAMP" | "ACTIVITY";
  entityId: string;
  childIds: string[];
  paymentMethod: "CARD" | "CASH";
  sessionPackageSize?: number;
  billingDetails?: {
    name: string;
    email: string;
    addressLine1: string;
    city: string;
    postalCode: string;
  };
}

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
      });
    }

    const user = await getUser(req);
    const role = await getUserRole(user.id);
    if (role !== "PARENT") {
      return new Response(
        JSON.stringify({ error: "Only parents can enroll children" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const body: EnrollmentRequest = await req.json();
    const { kind, entityId, childIds, paymentMethod, billingDetails } = body;
    const sessionPackageSize = body.sessionPackageSize ?? 1;

    if (!childIds?.length) {
      return new Response(
        JSON.stringify({ error: "At least one child must be specified" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate all children belong to parent
    const { data: children, error: childErr } = await supabaseAdmin
      .from("children")
      .select("id, name, parent_id")
      .in("id", childIds);
    if (childErr || !children?.length) {
      return new Response(
        JSON.stringify({ error: "Children not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    for (const child of children) {
      if (child.parent_id !== user.id) {
        return new Response(
          JSON.stringify({
            error: `Child does not belong to parent: ${child.name}`,
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Check existing enrollments for each child
    const { data: existingEnrollments } = await supabaseAdmin
      .from("enrollments")
      .select("id, child_id, status")
      .eq("kind", kind)
      .eq("entity_id", entityId)
      .in("child_id", childIds)
      .in("status", ["PENDING", "ACTIVE"]);

    const existingByChild = new Map<string, typeof existingEnrollments>();
    for (const e of existingEnrollments ?? []) {
      const list = existingByChild.get(e.child_id) ?? [];
      list.push(e);
      existingByChild.set(e.child_id, list);
    }

    // Validate no duplicate enrollments
    for (const child of children) {
      const existing = existingByChild.get(child.id) ?? [];
      if (paymentMethod === "CARD") {
        if (existing.some((e: any) => e.status === "ACTIVE")) {
          return new Response(
            JSON.stringify({
              error: `Child already enrolled: ${child.name}`,
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
      } else {
        // CASH: no existing at all
        if (existing.length > 0) {
          return new Response(
            JSON.stringify({
              error: `Child already enrolled: ${child.name}`,
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Count new enrollments needed
    const newEnrollmentCount = paymentMethod === "CARD"
      ? children.filter((c: any) => {
          const existing = existingByChild.get(c.id) ?? [];
          return !existing.some((e: any) => e.status === "PENDING");
        }).length
      : children.length;

    // Get entity price and validate capacity
    let entityPrice: number;
    let paymentCurrency = "RON";
    let effectiveSessionPackageSize = sessionPackageSize;

    if (kind === "COURSE") {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("price_per_session, currency, capacity")
        .eq("id", entityId)
        .single();
      if (!course) {
        return new Response(
          JSON.stringify({ error: "Course not found" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      entityPrice = course.price_per_session * effectiveSessionPackageSize;
      paymentCurrency = course.currency;
      if (newEnrollmentCount > 0 && course.capacity) {
        const { count } = await supabaseAdmin
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("kind", "COURSE")
          .eq("entity_id", entityId)
          .in("status", ["PENDING", "ACTIVE"]);
        const available = course.capacity - (count ?? 0);
        if (available < newEnrollmentCount) {
          return new Response(
            JSON.stringify({
              error: `Not enough spots. Requested: ${newEnrollmentCount}, Available: ${available}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    } else if (kind === "CAMP") {
      const { data: camp } = await supabaseAdmin
        .from("camps")
        .select("price, currency, capacity, allow_cash")
        .eq("id", entityId)
        .single();
      if (!camp) {
        return new Response(
          JSON.stringify({ error: "Camp not found" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      if (paymentMethod === "CASH" && !camp.allow_cash) {
        return new Response(
          JSON.stringify({
            error: "Cash payments not allowed for this camp",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      entityPrice = camp.price;
      paymentCurrency = camp.currency;
      effectiveSessionPackageSize = 1;
    } else {
      // ACTIVITY
      const { data: activity } = await supabaseAdmin
        .from("activities")
        .select("price, currency, capacity")
        .eq("id", entityId)
        .single();
      if (!activity) {
        return new Response(
          JSON.stringify({ error: "Activity not found" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      entityPrice = activity.price;
      paymentCurrency = activity.currency;
      effectiveSessionPackageSize = 1;
    }

    const now = new Date().toISOString();
    const savedEnrollments: any[] = [];

    for (const child of children) {
      // Create enrollment
      const { data: enrollment, error: enrollErr } = await supabaseAdmin
        .from("enrollments")
        .insert({
          kind,
          entity_id: entityId,
          child_id: child.id,
          status: "PENDING",
          created_at: now,
          purchased_sessions: 0,
          remaining_sessions: 0,
          sessions_used: 0,
        })
        .select("id")
        .single();

      if (enrollErr || !enrollment) {
        return new Response(
          JSON.stringify({ error: "Failed to create enrollment" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      // Create payment record
      const paymentData: any = {
        enrollment_id: enrollment.id,
        method: paymentMethod,
        amount: entityPrice,
        currency: paymentCurrency,
        status: "PENDING",
        created_at: now,
        updated_at: now,
      };

      if (paymentMethod === "CARD" && billingDetails) {
        paymentData.billing_name = billingDetails.name;
        paymentData.billing_email = billingDetails.email;
        paymentData.billing_address_line1 = billingDetails.addressLine1;
        paymentData.billing_city = billingDetails.city;
        paymentData.billing_postal_code = billingDetails.postalCode;
        paymentData.billing_country = "RO";
      }

      await supabaseAdmin.from("payments").insert(paymentData);

      // For CASH payments, broadcast notification
      if (paymentMethod === "CASH") {
        if (kind === "COURSE") {
          await supabaseAdmin.channel("admin:pending-cash-payments").send({
            type: "broadcast",
            event: "pending_cash_payment",
            payload: {
              enrollmentId: enrollment.id,
              sessionCount: effectiveSessionPackageSize,
              courseId: entityId,
            },
          });
        } else if (kind === "ACTIVITY") {
          await supabaseAdmin.channel("admin:pending-activity-payments").send({
            type: "broadcast",
            event: "pending_activity_payment",
            payload: {
              enrollmentId: enrollment.id,
              activityId: entityId,
              childName: child.name,
            },
          });
        }
      }

      savedEnrollments.push(enrollment);
    }

    const primaryId = savedEnrollments[0]?.id;
    return new Response(
      JSON.stringify({
        enrollmentId: primaryId,
        requiresPaymentIntent: paymentMethod === "CARD",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
