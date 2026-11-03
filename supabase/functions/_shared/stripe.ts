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

const STRIPE_FEE_FIXED_BANI = 100;
const STRIPE_FEE_CEILING_BASIS_POINTS = 515;

export function stripeFeeCeiling(amount: number): number {
  const safeAmount = Math.max(0, Math.round(amount));
  const ceiling = STRIPE_FEE_FIXED_BANI +
    Math.ceil(safeAmount * STRIPE_FEE_CEILING_BASIS_POINTS / 10000);
  return Math.min(safeAmount, ceiling);
}

export const WEEKLY_MONDAY_PAYOUTS = {
  payouts: { schedule: { interval: "weekly", weekly_anchor: "monday" } },
} as const;

export function paysOutWeeklyOnMonday(
  account: { settings?: { payouts?: { schedule?: { interval?: string; weekly_anchor?: string } } } },
): boolean {
  const schedule = account.settings?.payouts?.schedule;
  return schedule?.interval === "weekly" && schedule.weekly_anchor === "monday";
}
