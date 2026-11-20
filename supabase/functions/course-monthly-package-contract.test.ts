import {
  bucharestMonth,
  bucharestToday,
  chooseCourseOffer,
  type CoursePackageOffer,
  MONTH_CHANGED,
  monthLabel,
  packageMonths,
  snapshotMatchesChoice,
  snapshotMonthEnded,
} from "./_shared/course-package.ts";
import { createCoursePackageSnapshot, readPriceSnapshot } from "./_shared/price-snapshot.ts";
import { authorizedRonCharge } from "./_shared/payment-charge.ts";

function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function refusal(action: () => unknown): { status: number; body: Promise<Record<string, unknown>> } {
  try {
    action();
  } catch (error) {
    if (error instanceof Response) return { status: error.status, body: error.json() };
    throw error;
  }
  throw new Error("Expected a refusal");
}

async function rejects(action: () => Promise<unknown>): Promise<Response> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error("Expected a refusal");
}

const MONTHLY = "00000000-0000-4000-8000-000000000702";
const FOREVER = "00000000-0000-4000-8000-000000000700";
const offers = (): CoursePackageOffer[] => [
  { id: FOREVER, sessions: 8, price: 32000, validity: "NONE" },
  { id: MONTHLY, sessions: 12, price: 60000, validity: "CALENDAR_MONTH" },
];
const NOV_30_LATE = new Date("2026-11-30T21:30:00Z");
const DEC_1_EARLY = new Date("2026-11-30T22:30:00Z");

Deno.test("the month is the calendar month in Bucharest, also around midnight", () => {
  equal(bucharestMonth(NOV_30_LATE), "2026-11", "23:30 on 30 November in Bucharest");
  equal(bucharestMonth(DEC_1_EARLY), "2026-12", "00:30 on 1 December in Bucharest, still November in UTC");
  equal(bucharestToday(DEC_1_EARLY), "2026-12-01", "Bucharest date");
  equal(packageMonths(NOV_30_LATE), ["2026-11", "2026-12"], "current and next month");
  equal(packageMonths(new Date("2026-12-15T10:00:00Z")), ["2026-12", "2027-01"], "year change");
  equal(monthLabel("2026-11"), "noiembrie 2026", "label");
});

Deno.test("a monthly package is sold for the current or the next month only", async () => {
  const choice = chooseCourseOffer(offers(), { coursePackageId: MONTHLY, packageMonth: "2026-12" }, NOV_30_LATE);
  equal([choice.quantity, choice.coursePackage?.id, choice.month], [12, MONTHLY, "2026-12"], "next month");
  equal(chooseCourseOffer(offers(), { coursePackageId: MONTHLY, packageMonth: "2026-11" }, NOV_30_LATE).month, "2026-11",
    "current month");
  const late = refusal(() => chooseCourseOffer(offers(), { coursePackageId: MONTHLY, packageMonth: "2026-11" }, DEC_1_EARLY));
  equal([late.status, (await late.body).code], [409, MONTH_CHANGED], "November is over after midnight in Bucharest");
  equal(refusal(() => chooseCourseOffer(offers(), { coursePackageId: MONTHLY, packageMonth: "2027-01" }, NOV_30_LATE)).status,
    409, "two months ahead");
  equal(refusal(() => chooseCourseOffer(offers(), { coursePackageId: MONTHLY }, NOV_30_LATE)).status, 400, "month missing");
  equal(refusal(() => chooseCourseOffer(offers(), { coursePackageId: MONTHLY, packageMonth: "noiembrie" }, NOV_30_LATE)).status,
    400, "bad month");
  equal(refusal(() => chooseCourseOffer(offers(), { coursePackageId: FOREVER, packageMonth: "2026-11" }, NOV_30_LATE)).status,
    400, "a package without expiry has no month");
  equal(chooseCourseOffer(offers(), { coursePackageId: FOREVER }, NOV_30_LATE).month, null, "no-expiry package");
  equal(refusal(() => chooseCourseOffer([], { packageMonth: "2026-11" }, NOV_30_LATE)).status, 409,
    "a course without packages refuses a month");
});

Deno.test("the monthly snapshot binds its month and stays readable", async () => {
  const pkg = { id: MONTHLY, sessions: 12, price: 60000, validity: "CALENDAR_MONTH" };
  const november = await createCoursePackageSnapshot("course", "child-a", pkg, "RON", null, "2026-11");
  const december = await createCoursePackageSnapshot("course", "child-a", pkg, "RON", null, "2026-12");
  equal([november.validity, november.validMonth, november.amount, november.quantity], ["CALENDAR_MONTH", "2026-11", 60000, 12],
    "snapshot");
  equal(november.priceVersion === december.priceVersion, false, "the version binds the month");
  equal(await readPriceSnapshot(structuredClone(november)), november, "round trip");
  for (const tampered of [{ ...november, validMonth: "2026-12" }, { ...november, validMonth: "2026-13" }]) {
    await rejects(async () => {
      try {
        await readPriceSnapshot(tampered);
      } catch {
        throw new Response(null, { status: 400 });
      }
    });
  }
  const { validMonth: _, ...withoutMonth } = november;
  await rejects(async () => {
    try {
      await readPriceSnapshot(withoutMonth);
    } catch {
      throw new Response(null, { status: 400 });
    }
  });
  await rejects(async () => {
    try {
      await createCoursePackageSnapshot("course", "child-a", pkg, "RON", null);
    } catch {
      throw new Response(null, { status: 400 });
    }
  });
  const choice = chooseCourseOffer([pkg], { coursePackageId: MONTHLY, packageMonth: "2026-11" }, NOV_30_LATE);
  equal(snapshotMatchesChoice(november, choice), true, "same month matches");
  equal(snapshotMatchesChoice(december, choice), false, "another month does not match");
  equal(snapshotMonthEnded(november, DEC_1_EARLY), true, "November ended");
  equal(snapshotMonthEnded(december, DEC_1_EARLY), false, "December is running");
});

Deno.test("a card payment cannot start or resume for a month that has ended", async () => {
  const pkg = { id: MONTHLY, sessions: 12, price: 60000, validity: "CALENDAR_MONTH" };
  const snapshot = await createCoursePackageSnapshot("course", "child-a", pkg, "RON", null, "2026-11");
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { parent_id: "parent" }, error: null }) }) }) }),
  } as unknown as Parameters<typeof authorizedRonCharge>[0];
  const enrollment = { kind: "COURSE", entity_id: "course", child_id: "child-a", status: "ACTIVE" };
  const payment = { amount: 60000, currency: "RON", status: "PENDING", pricing_snapshot: snapshot };
  equal(await authorizedRonCharge(db, "parent", enrollment, payment, NOV_30_LATE), 60000, "before the month ends");
  const ended = await rejects(() => authorizedRonCharge(db, "parent", enrollment, payment, DEC_1_EARLY));
  equal([ended.status, (await ended.json()).code], [409, "MONTH_ENDED"], "after the month ends");
  const started = await rejects(() =>
    authorizedRonCharge(db, "parent", enrollment, { ...payment, gateway_txn_id: "pi_started" }, DEC_1_EARLY)
  );
  equal([started.status, (await started.json()).code], [409, "MONTH_ENDED"], "a started charge cannot be retried");
  equal(await authorizedRonCharge(db, "parent", enrollment, { ...payment, status: "SUCCEEDED", gateway_txn_id: "pi_paid" }, DEC_1_EARLY), 60000,
    "a paid package is still recognised");
});
