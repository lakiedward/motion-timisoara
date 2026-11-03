import { assert, assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { paysOutWeeklyOnMonday, stripeFeeCeiling, WEEKLY_MONDAY_PAYOUTS } from "./stripe.ts";

const lei = (n: number) => Math.round(n * 100);
const worstStripeFee = (bani: number) => 100 + Math.round(bani * 0.0515);

Deno.test("the ceiling is 1 RON + 5.15%, rounded up to the next ban", () => {
  assertEquals(stripeFeeCeiling(lei(200)), lei(11.3));
  assertEquals(stripeFeeCeiling(lei(320)), lei(17.48));
  assertEquals(stripeFeeCeiling(lei(0.99)), lei(0.99));
  assertEquals(stripeFeeCeiling(12345), 100 + 636);
});

Deno.test("the ceiling covers the most expensive card fee at every price", () => {
  for (let amount = lei(2); amount <= lei(5000); amount += 37) {
    assert(stripeFeeCeiling(amount) >= worstStripeFee(amount), `ceiling too low at ${amount} bani`);
  }
});

Deno.test("the ceiling never exceeds the charge and degenerate inputs stay at zero", () => {
  for (let amount = 0; amount <= lei(2000); amount += 7) {
    assert(stripeFeeCeiling(amount) <= amount, `fee exceeded charge at ${amount}`);
  }
  assertEquals(stripeFeeCeiling(0), 0);
  assertEquals(stripeFeeCeiling(-500), 0);
});

Deno.test("payouts are weekly on Monday", () => {
  assertEquals(WEEKLY_MONDAY_PAYOUTS.payouts.schedule, { interval: "weekly", weekly_anchor: "monday" });
  assert(paysOutWeeklyOnMonday({ settings: WEEKLY_MONDAY_PAYOUTS }));
  assert(!paysOutWeeklyOnMonday({ settings: { payouts: { schedule: { interval: "daily" } } } }));
  assert(!paysOutWeeklyOnMonday({ settings: { payouts: { schedule: { interval: "weekly", weekly_anchor: "friday" } } } }));
  assert(!paysOutWeeklyOnMonday({}));
});
