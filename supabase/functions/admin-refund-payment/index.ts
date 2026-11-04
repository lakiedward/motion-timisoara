import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getUser, getUserRole, supabaseAdmin } from "../_shared/supabase.ts";
import { getStripe } from "../_shared/stripe.ts";
import { withCors } from "../_shared/cors.ts";
import { adminRefundHandler, RefundRpcError, type RefundRow } from "./handler.ts";

serve(withCors(adminRefundHandler({
  getUser,
  getUserRole,
  beginRefund: async (request, adminId) => {
    const { data, error } = await supabaseAdmin.rpc("begin_payment_refund", {
      p_source: request.source,
      p_source_id: request.id,
      p_amount: request.amount,
      p_reason: request.reason,
      p_admin_user_id: adminId,
      p_cancel_enrollment: request.cancelEnrollment,
    });
    if (error) throw new RefundRpcError(error.message, error.code);
    return data as RefundRow;
  },
  settleRefund: async (refundId, stripeRefundId, status, failure) => {
    const { error } = await supabaseAdmin.rpc("settle_payment_refund", {
      p_refund_id: refundId,
      p_stripe_refund_id: stripeRefundId,
      p_status: status,
      p_failure_reason: failure,
    });
    if (error) throw new Error("Refund could not be settled");
  },
  paymentIntentFor: async (refund) => {
    if (refund.subscription_invoice_id) {
      const { data, error } = await supabaseAdmin.from("subscription_invoices")
        .select("stripe_payment_intent_id").eq("id", refund.subscription_invoice_id).single();
      if (error) throw new Error("Invoice could not be read");
      return data?.stripe_payment_intent_id ?? null;
    }
    const { data, error } = await supabaseAdmin.from("payments")
      .select("gateway_txn_id").eq("id", refund.payment_id).single();
    if (error) throw new Error("Payment could not be read");
    const reference: string | null = data?.gateway_txn_id ?? null;
    if (reference?.startsWith("pi_")) return reference;
    if (reference?.startsWith("cs_")) {
      const session = await getStripe().checkout.sessions.retrieve(reference);
      const intent = session.payment_intent;
      return typeof intent === "string" ? intent : intent?.id ?? null;
    }
    return null;
  },
  createStripeRefund: async (params, idempotencyKey) => {
    const refund = await getStripe().refunds.create(params, { idempotencyKey });
    return { id: refund.id, status: refund.status, failure_reason: refund.failure_reason ?? null };
  },
})));
