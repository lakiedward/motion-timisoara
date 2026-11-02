import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { calculatePlatformFee, PLATFORM_FEE_VAT_RATE } from "./stripe.ts";

const lei = (n: number) => Math.round(n * 100);
const stripeCost = (bani: number) => 100 + Math.round(bani * 0.015);

Deno.test("fee is 1 RON + 3.5% of the amount", () => {
  assertEquals(calculatePlatformFee(lei(200)).platformFeeBase, lei(8));
  assertEquals(calculatePlatformFee(lei(960)).platformFeeBase, lei(34.6));
  assertEquals(calculatePlatformFee(lei(1200)).platformFeeBase, lei(43));
});

Deno.test("the operator is not VAT registered, so the fee carries no VAT", () => {
  assertEquals(PLATFORM_FEE_VAT_RATE, 0);
  const f = calculatePlatformFee(lei(320));
  assertEquals(f.platformFeeBase, lei(12.2));
  assertEquals(f.platformFeeVat, 0);
  assertEquals(f.platformFeeTotal, lei(12.2));
  assertEquals(f.recipientAmount, lei(307.8));
});

Deno.test("the coach receives the amount minus the whole fee", () => {
  const f = calculatePlatformFee(lei(960));
  assertEquals(f.platformFeeTotal, lei(34.6));
  assertEquals(f.recipientAmount, lei(925.4));
});

Deno.test("a VAT rate, once registered, is added on top of the fee", () => {
  const f = calculatePlatformFee(lei(200), 0.21);
  assertEquals(f.platformFeeBase, lei(8));
  assertEquals(f.platformFeeVat, lei(1.68));
  assertEquals(f.platformFeeTotal, lei(9.68));
  assertEquals(f.recipientAmount, lei(190.32));
});

Deno.test("an invalid VAT rate is refused instead of mispricing a payment", () => {
  for (const rate of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertThrows(() => calculatePlatformFee(lei(200), rate), RangeError);
  }
});

Deno.test("margin over Stripe's cost is a constant 2% at every price", () => {
  for (const amount of [lei(5), lei(50), lei(120), lei(200), lei(600), lei(960), lei(5000)]) {
    const margin = calculatePlatformFee(amount).platformFeeBase - stripeCost(amount);
    assertEquals(margin, Math.round(amount * 0.02), `at ${amount} bani`);
  }
});

Deno.test("fee never exceeds the charge and never yields a negative payout", () => {
  for (const rate of [0, 0.21]) {
    for (let amount = 0; amount <= lei(2000); amount += 7) {
      const f = calculatePlatformFee(amount, rate);
      assert(f.platformFeeTotal <= amount, `fee exceeded charge at ${amount}, rate ${rate}`);
      assert(f.recipientAmount >= 0, `negative payout at ${amount}, rate ${rate}`);
    }
  }
});

Deno.test("the breakdown always adds up", () => {
  for (const rate of [0, 0.21]) {
    for (let amount = 0; amount <= lei(2000); amount += 13) {
      const f = calculatePlatformFee(amount, rate);
      assertEquals(f.platformFeeBase + f.platformFeeVat, f.platformFeeTotal, `at ${amount}`);
      assertEquals(f.platformFeeTotal + f.recipientAmount, f.totalAmount, `at ${amount}`);
    }
  }
});

Deno.test("degenerate inputs do not produce nonsense", () => {
  assertEquals(calculatePlatformFee(0).platformFeeTotal, 0);
  assertEquals(calculatePlatformFee(-500).platformFeeTotal, 0);
  assertEquals(calculatePlatformFee(-500).recipientAmount, 0);
  for (const rate of [0, 0.21]) {
    const tiny = calculatePlatformFee(lei(1), rate);
    assert(tiny.platformFeeTotal <= lei(1));
    assert(tiny.recipientAmount >= 0);
  }
});
