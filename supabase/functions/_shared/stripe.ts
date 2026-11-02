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

const PLATFORM_FEE_FIXED_BANI = 100;
const PLATFORM_FEE_PERCENT = 3.5;

export const PLATFORM_FEE_VAT_RATE = 0;

export interface PlatformFeeBreakdown {
  totalAmount: number;
  platformFeeBase: number;
  platformFeeVat: number;
  platformFeeTotal: number;
  recipientAmount: number;
}

export function calculatePlatformFee(
  amount: number,
  vatRate: number = PLATFORM_FEE_VAT_RATE,
): PlatformFeeBreakdown {
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate >= 1) {
    throw new RangeError("Platform fee VAT rate must be in [0, 1)");
  }
  const safeAmount = Math.max(0, Math.round(amount));
  const wantedBase = PLATFORM_FEE_FIXED_BANI +
    Math.round(safeAmount * PLATFORM_FEE_PERCENT / 100);
  const maxBase = Math.floor(safeAmount / (1 + vatRate));
  const baseFee = Math.min(wantedBase, maxBase);
  const vatOnFee = Math.round(baseFee * vatRate);
  const totalFee = baseFee + vatOnFee;

  return {
    totalAmount: safeAmount,
    platformFeeBase: baseFee,
    platformFeeVat: vatOnFee,
    platformFeeTotal: totalFee,
    recipientAmount: safeAmount - totalFee,
  };
}
