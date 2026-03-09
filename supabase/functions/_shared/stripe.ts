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

// Platform fee constants — preserved exactly from StripeConnectService.kt
const PLATFORM_FEE_PERCENT = 1.0; // 1%
const VAT_RATE = 0.19; // 19% TVA Romania

export interface PlatformFeeBreakdown {
  totalAmount: number;
  platformFeeBase: number;
  platformFeeVat: number;
  platformFeeTotal: number;
  recipientAmount: number;
}

/**
 * Calculate platform fee: 1% base + 19% VAT on fee = 1.19% total.
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
