// Edge Function: stripe-webhook
// Replaces: POST /api/webhooks/stripe
// Handles: payment_intent.succeeded, payment_intent.payment_failed

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getStripe } from "../_shared/stripe.ts";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripe = getStripe();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
    });
  }

  console.log(`[STRIPE] Webhook received: type=${event.type} id=${event.id}`);

  if (event.type === "payment_intent.succeeded") {
    await handlePaymentSucceeded(event);
  } else if (event.type === "payment_intent.payment_failed") {
    await handlePaymentFailed(event);
  }

  return new Response(JSON.stringify({ received: true, type: event.type }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handlePaymentSucceeded(event: any) {
  const intent = event.data.object;
  const paymentId = intent.metadata?.paymentId;

  if (!paymentId) {
    console.warn("[STRIPE] Missing paymentId in metadata!", intent.id);
    return;
  }

  // Get payment
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*, enrollment:enrollments(*, child:children(parent_id))")
    .eq("id", paymentId)
    .single();

  if (!payment) {
    console.warn("[STRIPE] Payment not found:", paymentId);
    return;
  }

  // Idempotency check
  if (payment.status === "SUCCEEDED") {
    console.log("[STRIPE] Payment already SUCCEEDED, skipping.");
    return;
  }

  const now = new Date().toISOString();

  // Update payment status
  await supabaseAdmin
    .from("payments")
    .update({
      status: "SUCCEEDED",
      updated_at: now,
      paid_at: now,
      gateway_txn_id: intent.id,
    })
    .eq("id", paymentId);

  // Activate enrollment and credit sessions
  const enrollment = payment.enrollment;
  const updateData: any = { status: "ACTIVE" };

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
        updateData.purchased_sessions = enrollment.purchased_sessions +
          sessionsAdded;
        updateData.remaining_sessions = enrollment.remaining_sessions +
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
    .update(updateData)
    .eq("id", enrollment.id);

  // Notify parent
  const parentId = enrollment.child?.parent_id;
  if (parentId) {
    await supabaseAdmin.channel(`user:${parentId}:payments`).send({
      type: "broadcast",
      event: "enrollment_ready",
      payload: {
        enrollmentId: enrollment.id,
        status: "ACTIVE",
      },
    });
  }
}

async function handlePaymentFailed(event: any) {
  const intent = event.data.object;
  const paymentId = intent.metadata?.paymentId;

  if (!paymentId) return;

  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("*, enrollment:enrollments(*, child:children(parent_id))")
    .eq("id", paymentId)
    .single();

  if (!payment) return;

  const now = new Date().toISOString();

  // Update payment to FAILED
  await supabaseAdmin
    .from("payments")
    .update({
      status: "FAILED",
      updated_at: now,
      gateway_txn_id: intent.id,
      client_secret: null,
      paid_at: null,
    })
    .eq("id", paymentId);

  // Cancel enrollment
  await supabaseAdmin
    .from("enrollments")
    .update({
      status: "CANCELLED",
      first_session_date: null,
      purchased_sessions: 0,
      remaining_sessions: 0,
      sessions_used: 0,
    })
    .eq("id", payment.enrollment.id);

  // Notify parent
  const parentId = payment.enrollment.child?.parent_id;
  if (parentId) {
    const failureReason = intent.last_payment_error?.message ??
      "Payment failed";
    await supabaseAdmin.channel(`user:${parentId}:payments`).send({
      type: "broadcast",
      event: "payment_failed",
      payload: {
        enrollmentId: payment.enrollment.id,
        reason: failureReason,
      },
    });
  }
}
