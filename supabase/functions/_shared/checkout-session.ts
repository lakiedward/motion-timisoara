import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";
import { calculatePlatformFee } from "./stripe.ts";

export const MAX_CHECKOUT_LINES = 10;

export interface CheckoutLine {
  paymentId: string;
  enrollmentId: string;
  amount: number;
  status: string;
  gatewayId: string | null;
  name: string;
}

export interface CheckoutOrder {
  lines: CheckoutLine[];
  destination: string | null;
  customerEmail: string | null;
  returnBase: string;
}

type CheckoutStripe = Pick<Stripe, "checkout" | "paymentIntents">;

export function paymentIdsKey(lines: Pick<CheckoutLine, "paymentId">[]) {
  return lines.map((line) => line.paymentId).sort().join(",");
}

export function sessionMatches(session: Stripe.Checkout.Session, lines: CheckoutLine[]) {
  return session.metadata?.paymentIds === paymentIdsKey(lines) &&
    session.currency === "ron" &&
    session.amount_total === lines.reduce((sum, line) => sum + line.amount, 0);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function releaseAttempt(
  stripe: CheckoutStripe,
  gatewayId: string,
  lines: CheckoutLine[],
): Promise<string | null> {
  if (gatewayId.startsWith("cs_")) {
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(gatewayId);
    } catch {
      throw enrollmentJson({ error: "Nu am putut verifica plata existentă. Încearcă din nou." }, 503);
    }
    if (session.status === "complete") {
      throw enrollmentJson({ error: "Plata este deja în curs de confirmare. Verifică în Înscrieri." }, 409);
    }
    if (session.status === "open") {
      const sameOrder = lines.every((line) => line.gatewayId === gatewayId) && sessionMatches(session, lines);
      if (sameOrder && session.url) return session.url;
      try {
        await stripe.checkout.sessions.expire(gatewayId);
      } catch {
        throw enrollmentJson({ error: "Plata anterioară nu a putut fi închisă. Încearcă din nou." }, 503);
      }
    }
    return null;
  }
  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.retrieve(gatewayId);
  } catch {
    throw enrollmentJson({ error: "Nu am putut verifica plata existentă. Încearcă din nou." }, 503);
  }
  if (["succeeded", "processing", "requires_capture"].includes(intent.status)) {
    throw enrollmentJson({ error: "Plata este deja în curs de confirmare. Verifică în Înscrieri." }, 409);
  }
  if (intent.status !== "canceled") {
    try {
      await stripe.paymentIntents.cancel(gatewayId);
    } catch {
      throw enrollmentJson({ error: "Plata anterioară nu a putut fi închisă. Încearcă din nou." }, 503);
    }
  }
  return null;
}

export async function prepareCheckoutSession(
  db: SupabaseClient,
  stripe: CheckoutStripe,
  order: CheckoutOrder,
  now = Date.now(),
): Promise<{ url: string } | { alreadyPaid: true }> {
  const payable = order.lines.filter((line) => line.status !== "SUCCEEDED");
  if (!order.lines.length || order.lines.length > MAX_CHECKOUT_LINES) {
    throw enrollmentJson({ error: "Alege între 1 și 10 înscrieri de plătit." }, 400);
  }
  if (!payable.length) return { alreadyPaid: true };
  if (payable.some((line) => !["PENDING", "FAILED"].includes(line.status) ||
    !Number.isSafeInteger(line.amount) || line.amount <= 0)) {
    throw enrollmentJson({ error: "Plata nu mai este în așteptare. Verifică în Înscrieri." }, 409);
  }

  const previous = [...new Set(payable.map((line) => line.gatewayId).filter((id): id is string => Boolean(id)))];
  for (const gatewayId of previous) {
    const url = await releaseAttempt(stripe, gatewayId, payable);
    if (url) return { url };
  }

  const ids = paymentIdsKey(payable);
  const minute = Math.floor(now / 60000);
  const enrollmentIds = payable.map((line) => line.enrollmentId).join(",");
  const fees = payable.map((line) => order.destination ? calculatePlatformFee(line.amount).platformFeeTotal : null);
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    locale: "ro",
    payment_method_types: ["card"],
    line_items: payable.map((line) => ({
      quantity: 1,
      price_data: { currency: "ron", unit_amount: line.amount, product_data: { name: line.name } },
    })),
    success_url: `${order.returnBase}/account/plata?rezultat=reusita&inscrieri=${enrollmentIds}`,
    cancel_url: `${order.returnBase}/account/plata?rezultat=anulata&inscrieri=${enrollmentIds}`,
    expires_at: minute * 60 + 45 * 60,
    metadata: { paymentIds: ids },
    payment_intent_data: { metadata: { paymentIds: ids } },
  };
  if (order.customerEmail) {
    params.customer_email = order.customerEmail;
    params.payment_intent_data!.receipt_email = order.customerEmail;
  }
  if (order.destination) {
    params.payment_intent_data!.application_fee_amount = fees.reduce<number>((sum, fee) => sum + (fee ?? 0), 0);
    params.payment_intent_data!.transfer_data = { destination: order.destination };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(params, {
      idempotencyKey: `checkout-${await sha256(`${ids}|${previous.join(",")}|${minute}`)}`,
    });
  } catch {
    throw enrollmentJson({ error: "Nu am putut deschide plata Stripe. Încearcă din nou." }, 503);
  }
  if (!session.url || !sessionMatches(session, payable)) {
    throw enrollmentJson({ error: "Stripe nu a returnat plata corectă. Încearcă din nou." }, 503);
  }

  for (const [index, line] of payable.entries()) {
    const fee = fees[index];
    let update = db.from("payments").update({
      gateway_txn_id: session.id,
      client_secret: null,
      platform_fee_amount: fee,
      coach_payout_amount: fee == null ? null : line.amount - fee,
    }).eq("id", line.paymentId).eq("method", "CARD").eq("status", line.status)
      .eq("amount", line.amount).eq("currency", "RON");
    update = line.gatewayId ? update.eq("gateway_txn_id", line.gatewayId) : update.is("gateway_txn_id", null);
    const saved = await update.select("id").single();
    if (saved.error || !saved.data) {
      try {
        await stripe.checkout.sessions.expire(session.id);
      } catch {
        console.error("Checkout session could not be expired after a failed save");
      }
      throw enrollmentJson({ error: "Plata s-a schimbat între timp. Reîncearcă din Înscrieri." }, 409);
    }
  }
  return { url: session.url };
}
