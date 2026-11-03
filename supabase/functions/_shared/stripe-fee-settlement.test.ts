import { assertEquals as equal, assertRejects } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { allocateByAmount, settleStripeFee, type SettlementStripe } from "./stripe-fee-settlement.ts";

interface Update {
  values: Record<string, unknown>;
  id: string;
  onlyUnsettled: boolean;
}

function fixture(options: {
  amount?: number;
  applicationFee?: number;
  refunded?: number;
  stripeFee?: number;
  currency?: string;
  balance?: "missing" | "id";
  feeDetails?: { type: string; amount: number }[];
} = {}) {
  const amount = options.amount ?? 50000;
  const applicationFee = options.applicationFee ?? 2675;
  const stripeFee = options.stripeFee ?? 850;
  const updates: Update[] = [];
  const refunds: { id: string; amount: number; key: string }[] = [];
  const expands: string[][] = [];
  const db = {
    from(table: string) {
      equal(table, "payments");
      return {
        update(values: Record<string, unknown>) {
          const update: Update = { values, id: "", onlyUnsettled: false };
          return {
            eq(_column: string, id: string) {
              update.id = id;
              return {
                is(column: string, value: null) {
                  update.onlyUnsettled = column === "stripe_fee_amount" && value === null;
                  updates.push(update);
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  const transaction = options.balance === "missing"
    ? null
    : options.balance === "id"
    ? "txn_1"
    : {
      id: "txn_1",
      currency: options.currency ?? "ron",
      fee: stripeFee,
      fee_details: options.feeDetails ?? [{ type: "stripe_fee", amount: stripeFee }],
    };
  const stripe: SettlementStripe = {
    charges: {
      retrieve: (id: string, params?: { expand?: string[] }) => {
        equal(id, "ch_1");
        expands.push(params?.expand ?? []);
        return Promise.resolve({
          id: "ch_1",
          amount,
          application_fee: "fee_1",
          balance_transaction: transaction,
        } as unknown as Stripe.Response<Stripe.Charge>);
      },
    } as SettlementStripe["charges"],
    applicationFees: {
      retrieve: (id: string) => {
        equal(id, "fee_1");
        return Promise.resolve({
          id,
          amount: applicationFee,
          amount_refunded: options.refunded ?? 0,
        } as unknown as Stripe.Response<Stripe.ApplicationFee>);
      },
      createRefund: (id: string, params?: { amount?: number }, request?: { idempotencyKey?: string }) => {
        refunds.push({ id, amount: params?.amount ?? 0, key: request?.idempotencyKey ?? "" });
        return Promise.resolve({} as Stripe.Response<Stripe.FeeRefund>);
      },
    } as SettlementStripe["applicationFees"],
  };
  const intent = {
    id: "pi_1",
    latest_charge: "ch_1",
    application_fee_amount: applicationFee,
    transfer_data: { destination: "acct_coach" },
  } as unknown as Stripe.PaymentIntent;
  return { db, stripe, intent, updates, refunds, expands };
}

Deno.test("the fee is split across lines by amount and always adds up", () => {
  equal(allocateByAmount(850, [{ paymentId: "a", amount: 50000 }]), [850]);
  equal(allocateByAmount(100, [{ paymentId: "a", amount: 1 }, { paymentId: "b", amount: 1 }, { paymentId: "c", amount: 1 }]), [34, 33, 33]);
  equal(allocateByAmount(1205, [{ paymentId: "a", amount: 40000 }, { paymentId: "b", amount: 30000 }]), [689, 516]);
  equal(allocateByAmount(0, [{ paymentId: "a", amount: 500 }]), [0]);
});

Deno.test("the application fee is refunded down to the exact Stripe fee and saved on the payment", async () => {
  const f = fixture();
  equal(await settleStripeFee(f.db, f.stripe, f.intent, [{ paymentId: "payment", amount: 50000 }]), "settled");
  equal(f.expands, [["balance_transaction"]]);
  equal(f.refunds, [{ id: "fee_1", amount: 2675 - 850, key: "stripe-fee-settlement-ch_1" }]);
  equal(f.updates, [{
    id: "payment",
    onlyUnsettled: true,
    values: {
      stripe_fee_amount: 850,
      platform_fee_amount: 850,
      coach_payout_amount: 49150,
      stripe_destination_account: "acct_coach",
    },
  }]);
});

Deno.test("a Checkout charge shares its Stripe fee between the children", async () => {
  const f = fixture({ amount: 70000, applicationFee: 3805, stripeFee: 1205 });
  await settleStripeFee(f.db, f.stripe, f.intent, [
    { paymentId: "a", amount: 40000 },
    { paymentId: "b", amount: 30000 },
  ]);
  equal(f.refunds.map((refund) => refund.amount), [3805 - 1205]);
  equal(f.updates.map((update) => [update.id, update.values.stripe_fee_amount, update.values.coach_payout_amount]), [
    ["a", 689, 39311],
    ["b", 516, 29484],
  ]);
});

Deno.test("a repeated settlement never refunds twice", async () => {
  const f = fixture({ refunded: 2675 - 850 });
  await settleStripeFee(f.db, f.stripe, f.intent, [{ paymentId: "payment", amount: 50000 }]);
  equal(f.refunds.length, 0);
  equal(f.updates[0].values.platform_fee_amount, 850);
});

Deno.test("a Stripe fee above the ceiling is absorbed by the platform", async () => {
  const f = fixture({ applicationFee: 2675, stripeFee: 3000 });
  await settleStripeFee(f.db, f.stripe, f.intent, [{ paymentId: "payment", amount: 50000 }]);
  equal(f.refunds.length, 0);
  equal(f.updates[0].values, {
    stripe_fee_amount: 3000,
    platform_fee_amount: 2675,
    coach_payout_amount: 47325,
    stripe_destination_account: "acct_coach",
  });
});

Deno.test("only Stripe's own fee counts, never tax or other fee lines", async () => {
  const f = fixture({ stripeFee: 900, feeDetails: [{ type: "stripe_fee", amount: 850 }, { type: "tax", amount: 50 }] });
  await settleStripeFee(f.db, f.stripe, f.intent, [{ paymentId: "payment", amount: 50000 }]);
  equal(f.updates[0].values.stripe_fee_amount, 850);
});

Deno.test("a charge whose balance is not ready stays at the ceiling for a retry", async () => {
  for (const balance of ["missing", "id"] as const) {
    const f = fixture({ balance });
    equal(await settleStripeFee(f.db, f.stripe, f.intent, [{ paymentId: "payment", amount: 50000 }]), "pending");
    equal(f.refunds.length + f.updates.length, 0);
  }
  const noCharge = fixture();
  equal(await settleStripeFee(noCharge.db, noCharge.stripe, { ...noCharge.intent, latest_charge: null }, []), "pending");
});

Deno.test("platform payments and non-RON balances are left untouched", async () => {
  const platform = fixture();
  const intent = { ...platform.intent, transfer_data: null, application_fee_amount: null } as unknown as Stripe.PaymentIntent;
  equal(await settleStripeFee(platform.db, platform.stripe, intent, [{ paymentId: "payment", amount: 50000 }]), "not_applicable");
  const euro = fixture({ currency: "eur" });
  equal(await settleStripeFee(euro.db, euro.stripe, euro.intent, [{ paymentId: "payment", amount: 50000 }]), "not_applicable");
  equal(platform.updates.length + euro.updates.length + euro.refunds.length, 0);
});

Deno.test("lines that do not add up to the charge are refused before any refund", async () => {
  const f = fixture();
  await assertRejects(() => settleStripeFee(f.db, f.stripe, f.intent, [{ paymentId: "payment", amount: 49999 }]));
  equal(f.refunds.length + f.updates.length, 0);
});
