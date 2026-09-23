import {
  convertToRon,
  createCompetitionPriceSnapshot,
  createPriceSnapshot,
  readPriceSnapshot,
} from "./price-snapshot.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
}

Deno.test(
  "integer conversion rounds the package total half up exactly once",
  () => {
    equal(convertToRon(10000, "EUR", 5123456), 51235);
    equal(convertToRon(1, "EUR", 1499999), 1);
    equal(convertToRon(1, "EUR", 1500000), 2);
    equal(convertToRon(1, "EUR", 1500001), 2);
    equal(convertToRon(1, "EUR", 1500000, 3), 5);
    equal(convertToRon(501, "RON", null, 3), 1503);
    equal(convertToRon(0, "EUR", 5000000), 0);
    equal(convertToRon(Number.MAX_SAFE_INTEGER, "EUR", 1), 9007199255);
  },
);

Deno.test(
  "invalid currencies, rates, counts and overflow are rejected without coercion",
  () => {
    const cases: unknown[][] = [
      [-1, "RON", null, 1],
      [1.5, "RON", null, 1],
      [NaN, "RON", null, 1],
      [Infinity, "RON", null, 1],
      ["100", "RON", null, 1],
      [100, "USD", null, 1],
      [100, "EUR", null, 1],
      [100, "EUR", 0, 1],
      [100, "EUR", -1, 1],
      [100, "EUR", 1.5, 1],
      [100, "EUR", "5000000", 1],
      [100, "EUR", Infinity, 1],
      [100, "EUR", NaN, 1],
      [100, "RON", 1000000, 1],
      [100, "RON", null, 0],
      [100, "RON", null, -1],
      [100, "RON", null, 1.5],
      [100, "RON", null, "1"],
      [100, "RON", null, Number.MAX_SAFE_INTEGER + 1],
      [Number.MAX_SAFE_INTEGER, "RON", null, 2],
      [Number.MAX_SAFE_INTEGER, "EUR", 5000000, 1],
    ];
    for (const values of cases) {
      let rejected = false;
      try {
        convertToRon(...(values as [number, string, number | null, number]));
      } catch {
        rejected = true;
      }
      equal(rejected, true);
    }
  },
);

Deno.test(
  "snapshot versions bind identity and all conversion inputs, including unchanged rounded amounts",
  async () => {
    const baseline = await createPriceSnapshot(
      "COURSE",
      "offer",
      "child",
      1,
      "EUR",
      5000000,
      1,
    );
    for (
      const replacement of [
        { kind: "ACTIVITY" },
        { entityId: "other" },
        { childId: "other" },
        { sourceUnitAmount: 2 },
        { sourceCurrency: "RON" },
        { quantity: 2 },
        { eurRonRateMicros: 5000001 },
        { amount: 4 },
        { currency: "EUR" },
        { priceVersion: "forged" },
        { schemaVersion: 2 },
      ]
    ) {
      let rejected = false;
      try {
        await readPriceSnapshot({ ...baseline, ...replacement });
      } catch {
        rejected = true;
      }
      equal(rejected, true);
    }
    const next = await createPriceSnapshot(
      "COURSE",
      "offer",
      "child",
      1,
      "EUR",
      5000001,
      1,
    );
    equal(next.amount, baseline.amount);
    equal(next.priceVersion === baseline.priceVersion, false);
    equal(await readPriceSnapshot(baseline), baseline);
  },
);

Deno.test(
  "adult camp snapshots keep child hashes byte-compatible and refuse a mixed subject",
  async () => {
    const child = await createPriceSnapshot(
      "CAMP",
      "camp",
      "child-a",
      8000,
      "RON",
      null,
      1,
    );
    const again = await createPriceSnapshot(
      "CAMP",
      "camp",
      "child-a",
      8000,
      "RON",
      null,
      1,
    );
    equal(child.priceVersion, again.priceVersion);
    equal(child.childId, "child-a");
    equal("adultProfileId" in child, false);
    const adult = await createPriceSnapshot(
      "CAMP",
      "camp",
      null,
      15000,
      "RON",
      null,
      1,
      "parent",
    );
    equal(adult.childId, null);
    equal(adult.adultProfileId, "parent");
    equal(await readPriceSnapshot(adult), adult);
    let rejected = false;
    try {
      await readPriceSnapshot({ ...adult, childId: "child-a" });
    } catch {
      rejected = true;
    }
    equal(rejected, true);
  },
);

Deno.test(
  "competition snapshot binds child, category, route and frozen RON price",
  async () => {
    const baseline = await createCompetitionPriceSnapshot(
      "competition",
      "child",
      "category",
      "route",
      "competition/route.gpx",
      12000,
    );
    equal(await readPriceSnapshot(baseline), baseline);
    equal(baseline.schemaVersion, 2);
    equal(baseline.amount, 12000);
    const maximum = await createCompetitionPriceSnapshot(
      "competition",
      "child",
      "category",
      "route",
      "competition/route.gpx",
      99_999_999,
    );
    equal(maximum.amount, 99_999_999);
    let overLimitRejected = false;
    try {
      await createCompetitionPriceSnapshot(
        "competition",
        "child",
        "category",
        "route",
        "competition/route.gpx",
        100_000_000,
      );
    } catch {
      overLimitRejected = true;
    }
    equal(overLimitRejected, true);
    for (
      const patch of [
        { childId: "another" },
        { categoryId: "another" },
        { routeId: "another" },
        { gpxStoragePath: "competition/changed.gpx" },
        { amount: 11999 },
        { sourceUnitAmount: 11999 },
        { schemaVersion: 1 },
        { sourceCurrency: "EUR" },
        { eurRonRateMicros: 5000000 },
        { quantity: 2 },
        { adultProfileId: "parent" },
      ]
    ) {
      let rejected = false;
      try {
        await readPriceSnapshot({ ...baseline, ...patch });
      } catch {
        rejected = true;
      }
      equal(rejected, true);
    }
    for (
      const [categoryId, routeId, path, price] of [
        ["another", "route", "competition/route.gpx", 12000],
        ["category", "another", "competition/route.gpx", 12000],
        ["category", "route", "competition/changed.gpx", 12000],
        ["category", "route", "competition/route.gpx", 0],
      ] as const
    ) {
      const next = await createCompetitionPriceSnapshot(
        "competition",
        "child",
        categoryId,
        routeId,
        path,
        price,
      );
      equal(next.priceVersion === baseline.priceVersion, false);
    }
  },
);

Deno.test("adult competition snapshot binds profile and birth date without changing child prices", async () => {
  const child = await createCompetitionPriceSnapshot(
    "competition",
    "child",
    "category",
    "route",
    "competition/route.gpx",
    12000,
  );
  const adult = await createCompetitionPriceSnapshot(
    "competition",
    { adultProfileId: "adult", adultBirthDate: "1985-05-10" },
    "category",
    "route",
    "competition/route.gpx",
    12000,
  );
  equal(adult.childId, null);
  equal(adult.adultProfileId, "adult");
  equal(adult.adultBirthDate, "1985-05-10");
  equal(adult.priceVersion === child.priceVersion, false);
  equal(await readPriceSnapshot(adult), adult);
  for (
    const patch of [
      { adultBirthDate: "1985-05-11" },
      { adultBirthDate: "1985-02-31" },
      { adultBirthDate: undefined },
      { adultProfileId: "other" },
      { childId: "child" },
    ]
  ) {
    let rejected = false;
    try {
      await readPriceSnapshot({ ...adult, ...patch });
    } catch {
      rejected = true;
    }
    equal(rejected, true);
  }
  let rejected = false;
  try {
    await readPriceSnapshot({ ...child, adultBirthDate: "1985-05-10" });
  } catch {
    rejected = true;
  }
  equal(rejected, true);
});
