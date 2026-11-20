import { chooseCourseOffer, type CoursePackageOffer, snapshotMatchesChoice } from "./_shared/course-package.ts";
import { createCoursePackageSnapshot, readPriceSnapshot } from "./_shared/price-snapshot.ts";

function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function status(action: () => unknown): number {
  try {
    action();
  } catch (error) {
    if (error instanceof Response) return error.status;
    throw error;
  }
  throw new Error("Expected a refusal");
}

async function throws(action: () => Promise<unknown>, label: string) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(`${label}: expected an error`);
}

const DAYS = "00000000-0000-4000-8000-000000000710";
const NOW = new Date("2026-11-20T10:00:00Z");
const offer = (days: number | null = 45): CoursePackageOffer => ({
  id: DAYS,
  sessions: 8,
  price: 32000,
  validity: "DAYS",
  validity_days: days,
});

Deno.test("a DAYS package is sold without a month and with the course's days", () => {
  const choice = chooseCourseOffer([offer()], { coursePackageId: DAYS }, NOW);
  equal([choice.quantity, choice.coursePackage?.validity_days, choice.month], [8, 45, null], "45-day package");
  equal(status(() => chooseCourseOffer([offer()], { coursePackageId: DAYS, packageMonth: "2026-11" }, NOW)), 400,
    "a DAYS package has no month");
  equal(status(() => chooseCourseOffer([offer(null)], { coursePackageId: DAYS }, NOW)), 409, "days missing");
  equal(status(() => chooseCourseOffer([offer(6)], { coursePackageId: DAYS }, NOW)), 409, "below 7 days");
  equal(status(() => chooseCourseOffer([offer(366)], { coursePackageId: DAYS }, NOW)), 409, "above 365 days");
  equal(
    status(() =>
      chooseCourseOffer([{ ...offer(), validity: "NONE" }], { coursePackageId: DAYS }, NOW)
    ),
    409,
    "a package without expiry cannot carry days",
  );
});

Deno.test("the DAYS snapshot binds its days and stays readable", async () => {
  const snapshot = await createCoursePackageSnapshot("course", "child-a", offer(), "RON", null);
  equal([snapshot.validity, snapshot.validDays, snapshot.validMonth, Object.keys(snapshot).length], ["DAYS", 45, undefined, 14],
    "14 keys with validDays");
  equal((await readPriceSnapshot(snapshot)).validDays, 45, "readable");
  const sixty = await createCoursePackageSnapshot("course", "child-a", offer(60), "RON", null);
  if (sixty.priceVersion === snapshot.priceVersion) throw new Error("the days must change the price version");
  await throws(() => readPriceSnapshot({ ...snapshot, validDays: 60 }), "tampered days");
  await throws(() => readPriceSnapshot({ ...snapshot, validDays: 400 }), "days out of range");
  const { validDays: _ignored, ...withoutDays } = snapshot;
  await throws(() => readPriceSnapshot(withoutDays), "days missing");
  await throws(() => createCoursePackageSnapshot("course", "child-a", offer(), "RON", null, "2026-11"), "month on DAYS");
  await throws(() => createCoursePackageSnapshot("course", "child-a", offer(3), "RON", null), "too few days");
  const none = await createCoursePackageSnapshot("course", "child-a", { ...offer(null), validity: "NONE" }, "RON", null);
  equal([none.validDays, Object.keys(none).length], [undefined, 13], "NONE keeps the 00149 shape");
});

Deno.test("a pending DAYS payment matches only the same package with the same days", async () => {
  const snapshot = await createCoursePackageSnapshot("course", "child-a", offer(), "RON", null);
  const same = chooseCourseOffer([offer()], { coursePackageId: DAYS }, NOW);
  const changed = chooseCourseOffer([offer(30)], { coursePackageId: DAYS }, NOW);
  equal(snapshotMatchesChoice(snapshot, same), true, "same days");
  equal(snapshotMatchesChoice(snapshot, changed), false, "the coach changed the days");
});
