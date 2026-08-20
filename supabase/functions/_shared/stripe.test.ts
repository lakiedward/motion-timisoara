// Tests for the platform fee maths. Run with: deno test supabase/functions/_shared/
//
// This is the only money arithmetic in the codebase and it had no coverage at
// all, which is how a fee that did not cover Stripe's own cost survived a
// backend migration unnoticed.
import { assert, assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { calculatePlatformFee } from "./stripe.ts";

const lei = (n: number) => Math.round(n * 100);
/** Stripe's own cost to us: ~1.5% + 1 RON for a standard European card. */
const stripeCost = (bani: number) => 100 + Math.round(bani * 0.015);

Deno.test("fee is 1 RON + 3.5% of the amount, before VAT", () => {
  assertEquals(calculatePlatformFee(lei(200)).platformFeeBase, lei(8)); // 1 + 7
  assertEquals(calculatePlatformFee(lei(960)).platformFeeBase, lei(34.6)); // 1 + 33.60
  assertEquals(calculatePlatformFee(lei(1200)).platformFeeBase, lei(43)); // 1 + 42
});

Deno.test("VAT is added on top of the fee, not carved out of it", () => {
  const f = calculatePlatformFee(lei(200));
  assertEquals(f.platformFeeBase, lei(8));
  assertEquals(f.platformFeeVat, lei(1.52)); // 19% of 8.00
  assertEquals(f.platformFeeTotal, lei(9.52));
});

Deno.test("the coach receives the amount minus the whole fee", () => {
  const f = calculatePlatformFee(lei(960));
  assertEquals(f.platformFeeTotal, lei(41.17));
  assertEquals(f.recipientAmount, lei(918.83));
});

Deno.test("margin over Stripe's cost is a constant 2% at every price", () => {
  // This is the reason for the fixed component: our 1 RON cancels Stripe's,
  // leaving a clean percentage rather than a break-even threshold to police.
  for (const amount of [lei(5), lei(50), lei(120), lei(200), lei(600), lei(960), lei(5000)]) {
    const margin = calculatePlatformFee(amount).platformFeeBase - stripeCost(amount);
    assertEquals(margin, Math.round(amount * 0.02), `at ${amount} bani`);
  }
});

Deno.test("fee never exceeds the charge and never yields a negative payout", () => {
  for (let amount = 0; amount <= lei(2000); amount += 7) {
    const f = calculatePlatformFee(amount);
    assert(f.platformFeeTotal <= amount, `fee exceeded charge at ${amount}`);
    assert(f.recipientAmount >= 0, `negative payout at ${amount}`);
  }
});

Deno.test("the breakdown always adds up", () => {
  for (let amount = 0; amount <= lei(2000); amount += 13) {
    const f = calculatePlatformFee(amount);
    assertEquals(f.platformFeeBase + f.platformFeeVat, f.platformFeeTotal, `at ${amount}`);
    assertEquals(f.platformFeeTotal + f.recipientAmount, f.totalAmount, `at ${amount}`);
  }
});

Deno.test("degenerate inputs do not produce nonsense", () => {
  assertEquals(calculatePlatformFee(0).platformFeeTotal, 0);
  assertEquals(calculatePlatformFee(-500).platformFeeTotal, 0);
  assertEquals(calculatePlatformFee(-500).recipientAmount, 0);
  // A 1 RON charge cannot carry a 1 RON fee plus VAT, so the fee is capped.
  const tiny = calculatePlatformFee(lei(1));
  assert(tiny.platformFeeTotal <= lei(1));
  assert(tiny.recipientAmount >= 0);
});
