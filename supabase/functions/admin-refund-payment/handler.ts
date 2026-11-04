import { enrollmentJson } from "../_shared/enrollment-pricing.ts";

export type RefundSource = "PAYMENT" | "SUBSCRIPTION_INVOICE";
export type RefundStatus = "pending" | "succeeded" | "failed" | "canceled" | "requires_action";

export interface RefundRow {
  id: string;
  payment_id: string | null;
  subscription_invoice_id: string | null;
  method: "CARD" | "CASH";
  amount: number;
  status: RefundStatus;
  reverse_transfer: boolean;
}

export interface RefundRequest {
  source: RefundSource;
  id: string;
  amount: number;
  reason: string;
  cancelEnrollment: boolean;
}

export class RefundRpcError extends Error {
  constructor(message: string, readonly code: string | undefined) {
    super(message);
  }
}

export interface StripeRefundResult {
  id: string;
  status: string | null;
  failure_reason?: string | null;
}

export interface AdminRefundServices {
  getUser(req: Request): Promise<{ id: string }>;
  getUserRole(userId: string): Promise<string | null>;
  beginRefund(request: RefundRequest, adminId: string): Promise<RefundRow>;
  settleRefund(refundId: string, stripeRefundId: string | null, status: RefundStatus, failure: string | null): Promise<void>;
  paymentIntentFor(refund: RefundRow): Promise<string | null>;
  createStripeRefund(
    params: {
      payment_intent: string;
      amount: number;
      reverse_transfer?: boolean;
      refund_application_fee?: boolean;
      metadata: Record<string, string>;
    },
    idempotencyKey: string,
  ): Promise<StripeRefundResult>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set<RefundStatus>(["pending", "succeeded", "failed", "canceled", "requires_action"]);

export function parseRefundRequest(body: unknown): RefundRequest | string {
  if (!body || typeof body !== "object") return "Cererea nu este validă.";
  const value = body as Record<string, unknown>;
  if (value.source !== "PAYMENT" && value.source !== "SUBSCRIPTION_INVOICE") return "Alege plata de rambursat.";
  if (typeof value.id !== "string" || !UUID.test(value.id)) return "Plata nu este validă.";
  if (typeof value.amount !== "number" || !Number.isSafeInteger(value.amount) || value.amount <= 0) {
    return "Suma de rambursat nu este validă.";
  }
  if (typeof value.reason !== "string") return "Scrie motivul rambursării.";
  const reason = value.reason.trim();
  if (reason.length < 3 || reason.length > 500) return "Motivul trebuie să aibă între 3 și 500 de caractere.";
  return {
    source: value.source,
    id: value.id,
    amount: value.amount,
    reason,
    cancelEnrollment: value.cancelEnrollment === true,
  };
}

export function stripeRefundStatus(status: string | null | undefined): RefundStatus {
  return status && STATUSES.has(status as RefundStatus) ? status as RefundStatus : "pending";
}

function rpcFailure(error: RefundRpcError) {
  if (error.code === "42501") return enrollmentJson({ error: "Doar administratorii pot rambursa." }, 403);
  if (error.code === "P0002") return enrollmentJson({ error: "Plata nu a fost găsită." }, 404);
  if (error.code === "22023") return enrollmentJson({ error: error.message }, 400);
  return enrollmentJson({ error: "Nu am putut începe rambursarea." }, 503);
}

export function adminRefundHandler(services: AdminRefundServices) {
  return async (req: Request) => {
    if (req.method !== "POST") return enrollmentJson({ error: "Method not allowed" }, 405);
    const user = await services.getUser(req);
    if (await services.getUserRole(user.id) !== "ADMIN") {
      return enrollmentJson({ error: "Doar administratorii pot rambursa." }, 403);
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return enrollmentJson({ error: "Cererea nu este validă." }, 400);
    }
    const request = parseRefundRequest(body);
    if (typeof request === "string") return enrollmentJson({ error: request }, 400);

    let refund: RefundRow;
    try {
      refund = await services.beginRefund(request, user.id);
    } catch (error) {
      if (error instanceof RefundRpcError) return rpcFailure(error);
      return enrollmentJson({ error: "Nu am putut începe rambursarea." }, 503);
    }
    if (refund.method === "CASH") {
      return enrollmentJson({ refundId: refund.id, status: refund.status });
    }

    const intent = await services.paymentIntentFor(refund).catch(() => null);
    if (!intent) {
      await services.settleRefund(refund.id, null, "failed", "Plata nu are o referință Stripe.");
      return enrollmentJson({ error: "Plata nu are o referință Stripe, deci nu poate fi rambursată aici." }, 409);
    }

    let result: StripeRefundResult;
    try {
      result = await services.createStripeRefund({
        payment_intent: intent,
        amount: refund.amount,
        ...(refund.reverse_transfer ? { reverse_transfer: true, refund_application_fee: false } : {}),
        metadata: { refund_row_id: refund.id, source: request.source, source_id: request.id },
      }, `admin-refund-${refund.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Stripe a refuzat rambursarea.";
      await services.settleRefund(refund.id, null, "failed", message).catch(() => undefined);
      return enrollmentJson({ error: `Stripe a refuzat rambursarea: ${message}` }, 502);
    }
    const status = stripeRefundStatus(result.status);
    try {
      await services.settleRefund(refund.id, result.id, status, result.failure_reason ?? null);
    } catch {
      return enrollmentJson({ refundId: refund.id, status, warning: "Rambursarea s-a făcut în Stripe; starea se actualizează din webhook." });
    }
    return enrollmentJson({ refundId: refund.id, status });
  };
}
