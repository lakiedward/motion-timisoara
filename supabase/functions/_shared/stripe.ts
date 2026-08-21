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

// Platform fee: a fixed component plus a percentage, deliberately shaped like
// Stripe's own pricing (roughly 1 RON + 1.5% for a standard European card).
//
// Matching the shape is the whole point. Under a flat percentage there is an
// amount below which the platform loses money, because Stripe's fixed leu does
// not shrink with the ticket — at a flat 3% that break-even sat around 67 RON.
// Charging a fixed leu of our own cancels Stripe's, leaving a margin of a
// constant ~2% of the amount at every price. Cheap sessions stop being
// loss-making, and there is no threshold to police.
//
// It also survives expensive cards. Premium, UK and non-EEA cards cost between
// 2.5% and 3.15% + 1 RON, which a flat 3% would not have covered; 1 RON + 3.5%
// stays positive on all of them, thinly at the top end.
//
// What this does NOT cover, because no per-transaction fee can: Stripe's monthly
// fee per active connected account, per-payout fees, and chargebacks.
const PLATFORM_FEE_FIXED_BANI = 100; // 1.00 RON
const PLATFORM_FEE_PERCENT = 3.5; // 3.5%

// Romanian VAT, added ON TOP of the fee, so the recipient is charged more than
// the headline rate and the platform owes the VAT part to the state.
//
// NOTE: the standard rate has been 21% since 2025-08-01. This deliberately still
// says 19% because the real question is upstream: if Motion is not VAT
// registered the fee should carry no VAT at all, and if it is, the rate is 21%.
// Do not bump this number without settling that first.
const VAT_RATE = 0.19;

export interface PlatformFeeBreakdown {
  totalAmount: number;
  platformFeeBase: number;
  platformFeeVat: number;
  platformFeeTotal: number;
  recipientAmount: number;
}

/**
 * Calculate platform fee: 1.00 RON + 3.5% of the amount, plus VAT on that fee.
 * Uses Math.round (HALF_UP equivalent) for financial precision.
 *
 * The fee is capped so that fee-plus-VAT can never exceed the charge: Stripe
 * rejects an application fee larger than the payment, and a negative payout to
 * the coach would be nonsense. The cap only ever bites on amounts of a few lei,
 * where the fixed component alone is most of the ticket.
 *
 * @param amount Amount in smallest currency unit (bani for RON)
 */
export function calculatePlatformFee(amount: number): PlatformFeeBreakdown {
  const safeAmount = Math.max(0, Math.round(amount));
  const wantedBase = PLATFORM_FEE_FIXED_BANI +
    Math.round(safeAmount * PLATFORM_FEE_PERCENT / 100);
  // Largest base fee whose VAT still fits inside the charge.
  const maxBase = Math.floor(safeAmount / (1 + VAT_RATE));
  const baseFee = Math.min(wantedBase, maxBase);
  const vatOnFee = Math.round(baseFee * VAT_RATE);
  const totalFee = baseFee + vatOnFee;
  const recipientAmount = safeAmount - totalFee;

  return {
    // safeAmount, not the raw argument, so that
    // platformFeeTotal + recipientAmount === totalAmount always holds.
    totalAmount: safeAmount,
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
