import Stripe from "https://esm.sh/stripe@14?target=deno";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key || key === "NOT_CONFIGURED") {
      throw new Error("Stripe is not configured");
    }
    _stripe = new Stripe(key, { apiVersion: "2024-04-10" });
  }
  return _stripe;
}

// Platform fee constants.
//
// 3% base. The 1% inherited from StripeConnectService.kt did not cover Stripe's
// own processing fee: in a destination charge without `on_behalf_of` the
// platform is the merchant of record, so Stripe bills its fee to the platform
// balance and the application fee is the only thing covering it. At roughly
// 1.5% + 1 RON for European cards, 1% lost money on every single transaction.
//
// Break-even is `1.5% + 1 RON / amount`, so small payments are the hard case:
// at 3% a card payment only pays for itself above about 67 RON. Sell monthly or
// in session packages rather than single cheap sessions.
//
// VAT is added ON TOP of the base fee, so the recipient is charged 3.57% and the
// platform owes the 0.57% to the state — real revenue is the 3%.
const PLATFORM_FEE_PERCENT = 3.0; // 3%
const VAT_RATE = 0.19; // 19% TVA Romania

export interface PlatformFeeBreakdown {
  totalAmount: number;
  platformFeeBase: number;
  platformFeeVat: number;
  platformFeeTotal: number;
  recipientAmount: number;
}

/**
 * Calculate platform fee: 3% base + 19% VAT on fee = 3.57% total.
 * Uses Math.round (HALF_UP equivalent) for financial precision.
 * @param amount Amount in smallest currency unit (bani for RON)
 */
export function calculatePlatformFee(amount: number): PlatformFeeBreakdown {
  const baseFee = Math.round(amount * PLATFORM_FEE_PERCENT / 100);
  const vatOnFee = Math.round(baseFee * VAT_RATE);
  const totalFee = baseFee + vatOnFee;
  const recipientAmount = amount - totalFee;

  return {
    totalAmount: amount,
    platformFeeBase: baseFee,
    platformFeeVat: vatOnFee,
    platformFeeTotal: totalFee,
    recipientAmount,
  };
}

/**
 * Cancel a PaymentIntent that is still open. No-ops if already terminal or missing.
 * Used by draft rollback and intent reuse so orphan client secrets cannot be charged.
 */
export async function cancelOpenPaymentIntent(intentId: string | null | undefined): Promise<void> {
  if (!intentId) return;
  try {
    const stripe = getStripe();
    const existing = await stripe.paymentIntents.retrieve(intentId);
    const cancellable = new Set([
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
      "requires_capture",
    ]);
    if (cancellable.has(existing.status)) {
      await stripe.paymentIntents.cancel(intentId);
    }
  } catch (err) {
    console.error("cancelOpenPaymentIntent failed:", intentId, err);
  }
}
