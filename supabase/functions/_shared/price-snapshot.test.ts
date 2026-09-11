import { convertToRon, createPriceSnapshot, readPriceSnapshot } from "./price-snapshot.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

Deno.test("integer conversion rounds the package total half up exactly once", () => {
  equal(convertToRon(10000, "EUR", 5123456), 51235);
  equal(convertToRon(1, "EUR", 1499999), 1);
  equal(convertToRon(1, "EUR", 1500000), 2);
  equal(convertToRon(1, "EUR", 1500001), 2);
  equal(convertToRon(1, "EUR", 1500000, 3), 5);
  equal(convertToRon(501, "RON", null, 3), 1503);
  equal(convertToRon(0, "EUR", 5000000), 0);
  equal(convertToRon(Number.MAX_SAFE_INTEGER, "EUR", 1), 9007199255);
});

Deno.test("invalid currencies, rates, counts and overflow are rejected without coercion", () => {
  const cases: unknown[][] = [
    [-1, "RON", null, 1], [1.5, "RON", null, 1], [NaN, "RON", null, 1],
    [Infinity, "RON", null, 1], ["100", "RON", null, 1], [100, "USD", null, 1],
    [100, "EUR", null, 1], [100, "EUR", 0, 1], [100, "EUR", -1, 1], [100, "EUR", 1.5, 1],
    [100, "EUR", "5000000", 1], [100, "EUR", Infinity, 1], [100, "EUR", NaN, 1],
    [100, "RON", 1000000, 1], [100, "RON", null, 0], [100, "RON", null, -1],
    [100, "RON", null, 1.5], [100, "RON", null, "1"], [100, "RON", null, Number.MAX_SAFE_INTEGER + 1],
    [Number.MAX_SAFE_INTEGER, "RON", null, 2], [Number.MAX_SAFE_INTEGER, "EUR", 5000000, 1],
  ];
  for (const values of cases) {
    let rejected = false;
    try { convertToRon(...values as [number, string, number | null, number]); } catch { rejected = true; }
    equal(rejected, true);
  }
});

Deno.test("snapshot versions bind identity and all conversion inputs, including unchanged rounded amounts", async () => {
  const baseline = await createPriceSnapshot("COURSE", "offer", "child", 1, "EUR", 5000000, 1);
  for (const replacement of [
    { kind: "ACTIVITY" }, { entityId: "other" }, { childId: "other" }, { sourceUnitAmount: 2 },
    { sourceCurrency: "RON" }, { quantity: 2 }, { eurRonRateMicros: 5000001 },
    { amount: 4 }, { currency: "EUR" }, { priceVersion: "forged" }, { schemaVersion: 2 },
  ]) {
    let rejected = false;
    try { await readPriceSnapshot({ ...baseline, ...replacement }); } catch { rejected = true; }
    equal(rejected, true);
  }
  const next = await createPriceSnapshot("COURSE", "offer", "child", 1, "EUR", 5000001, 1);
  equal(next.amount, baseline.amount);
  equal(next.priceVersion === baseline.priceVersion, false);
  equal(await readPriceSnapshot(baseline), baseline);
});
