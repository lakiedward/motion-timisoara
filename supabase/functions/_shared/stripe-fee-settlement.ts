import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SettlementLine {
  paymentId: string;
  amount: number;
}

export type SettlementResult = "settled" | "not_applicable" | "pending";

export type SettlementStripe = {
  charges: Pick<Stripe["charges"], "retrieve">;
  applicationFees: Pick<Stripe["applicationFees"], "retrieve" | "createRefund">;
};

export function allocateByAmount(total: number, lines: SettlementLine[]): number[] {
  const sum = lines.reduce((acc, line) => acc + line.amount, 0);
  if (sum <= 0 || total <= 0) return lines.map(() => 0);
  const exact = lines.map((line) => (total * line.amount) / sum);
  const shares = exact.map(Math.floor);
  let left = total - shares.reduce((acc, share) => acc + share, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - shares[index] }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    shares[index] += 1;
    left -= 1;
  }
  return shares;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

interface FeeTransaction {
  currency: string;
  fee: number;
  fee_details?: { type: string; amount: number }[];
}

function stripeProcessingFee(transaction: FeeTransaction): number {
  const details = transaction.fee_details ?? [];
  if (!details.length) return transaction.fee;
  return details
    .filter((detail) => detail.type === "stripe_fee")
    .reduce((sum: number, detail) => sum + detail.amount, 0);
}

export async function settleStripeFee(
  db: SupabaseClient,
  stripe: SettlementStripe,
  intent: Stripe.PaymentIntent,
  lines: SettlementLine[],
): Promise<SettlementResult> {
  const destination = idOf(intent.transfer_data?.destination as string | { id: string } | null);
  if (!destination || intent.application_fee_amount == null) return "not_applicable";
  const chargeId = idOf(intent.latest_charge as string | { id: string } | null);
  if (!chargeId) return "pending";

  const charge = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
  const transaction = charge.balance_transaction as FeeTransaction | string | null;
  if (!transaction || typeof transaction === "string") return "pending";
  if (transaction.currency !== "ron") {
    console.error("Stripe fee settlement skipped: balance is not in RON");
    return "not_applicable";
  }
  if (lines.reduce((sum, line) => sum + line.amount, 0) !== charge.amount) {
    throw new Error("Settlement lines do not match the charge");
  }
  const feeId = idOf(charge.application_fee as string | { id: string } | null);
  if (!feeId) return "pending";

  const stripeFee = stripeProcessingFee(transaction);
  const applicationFee = await stripe.applicationFees.retrieve(feeId);
  const withheld = Math.min(applicationFee.amount, stripeFee);
  const refund = applicationFee.amount - applicationFee.amount_refunded - withheld;
  if (refund > 0) {
    await stripe.applicationFees.createRefund(
      feeId,
      { amount: refund, metadata: { reason: "exact_stripe_fee" } },
      { idempotencyKey: `stripe-fee-settlement-${charge.id}` },
    );
  }

  const fees = allocateByAmount(stripeFee, lines);
  const kept = allocateByAmount(withheld, lines);
  for (const [index, line] of lines.entries()) {
    const { error } = await db.from("payments").update({
      stripe_fee_amount: fees[index],
      platform_fee_amount: kept[index],
      coach_payout_amount: line.amount - kept[index],
      stripe_destination_account: destination,
    }).eq("id", line.paymentId).is("stripe_fee_amount", null);
    if (error) throw new Error("Stripe fee could not be saved");
  }
  return "settled";
}
