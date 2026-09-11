import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";

interface IntentPayment {
  id: string;
  enrollment_id: string;
  amount: number;
  currency: string;
  status: string;
  gateway_txn_id: string | null;
}

function verifyIntent(intent: Stripe.PaymentIntent, payment: IntentPayment) {
  if (intent.amount !== payment.amount || intent.currency !== "ron" ||
    intent.metadata.paymentId !== payment.id || intent.metadata.enrollmentId !== payment.enrollment_id) {
    throw enrollmentJson({ error: "Plata Stripe nu corespunde ofertei confirmate." }, 409);
  }
}

export async function preparePaymentIntent(
  db: SupabaseClient,
  stripe: Pick<Stripe, "paymentIntents">,
  payment: IntentPayment,
  params: Stripe.PaymentIntentCreateParams,
) {
  if (payment.gateway_txn_id) {
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(payment.gateway_txn_id);
    } catch {
      throw enrollmentJson({ error: "Nu am putut verifica plata existentă. Încearcă din nou." }, 503);
    }
    verifyIntent(intent, payment);
    if (intent.status === "succeeded") return { clientSecret: intent.client_secret, alreadySucceeded: true };
    if (payment.status === "SUCCEEDED") throw enrollmentJson({ error: "Plata este deja procesată." }, 409);
    if (!["requires_payment_method", "requires_confirmation", "requires_action"].includes(intent.status) || !intent.client_secret) {
      throw enrollmentJson({ error: "Plata nu poate fi reluată acum. Verifică starea în Înscrieri." }, 409);
    }
    return { clientSecret: intent.client_secret };
  }
  if (!["PENDING", "FAILED"].includes(payment.status)) throw enrollmentJson({ error: "Plata nu mai este în așteptare." }, 409);
  if (params.amount !== payment.amount || params.currency !== "ron" || params.metadata?.paymentId !== payment.id ||
    params.metadata?.enrollmentId !== payment.enrollment_id) {
    throw enrollmentJson({ error: "Parametrii plății nu corespund ofertei acceptate." }, 409);
  }
  const frozen = await db.rpc("freeze_payment_intent_request", { p_payment_id: payment.id, p_params: params });
  if (frozen.error || !frozen.data) {
    throw enrollmentJson({ error: "Nu am putut verifica pregătirea plății. Reîncearcă sau contactează organizatorul dacă problema persistă." }, 409);
  }
  const savedParams = frozen.data as Stripe.PaymentIntentCreateParams;
  if (savedParams.amount !== payment.amount || savedParams.currency !== "ron" ||
    savedParams.metadata?.paymentId !== payment.id || savedParams.metadata?.enrollmentId !== payment.enrollment_id) {
    throw enrollmentJson({ error: "Cererea Stripe salvată nu corespunde plății." }, 409);
  }
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(savedParams, { idempotencyKey: `enrollment-payment-${payment.id}` });
  } catch {
    throw enrollmentJson({ error: "Nu am putut pregăti plata. Încearcă din nou." }, 503);
  }
  verifyIntent(intent, payment);
  if (!intent.client_secret) throw enrollmentJson({ error: "Stripe nu a returnat detaliile plății." }, 503);
  const saved = await db.from("payments").update({
    gateway_txn_id: intent.id,
    client_secret: intent.client_secret,
    platform_fee_amount: savedParams.application_fee_amount ?? null,
    coach_payout_amount: savedParams.application_fee_amount == null ? null : payment.amount - savedParams.application_fee_amount,
  }).eq("id", payment.id).eq("method", "CARD").eq("status", payment.status)
    .eq("amount", payment.amount).eq("currency", "RON").is("gateway_txn_id", null).select("id").single();
  if (saved.error || !saved.data) {
    throw enrollmentJson({ error: "Nu am putut salva plata pregătită. Reîncearcă pentru a verifica starea." }, 409);
  }
  return { clientSecret: intent.client_secret };
}
