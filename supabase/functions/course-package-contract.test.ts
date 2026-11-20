import { createValidationHandler } from "./validate-enrollment/handler.ts";
import { createEnrollmentHandler } from "./create-enrollment/handler.ts";
import { chooseCourseOffer, PACKAGE_CHANGED, type CoursePackageOffer } from "./_shared/course-package.ts";
import { createCoursePackageSnapshot, readPriceSnapshot, type PriceSnapshot } from "./_shared/price-snapshot.ts";
import type { EnrollmentServices } from "./_shared/enrollment-pricing.ts";

type Row = Record<string, unknown>;

function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const PACKAGE_8 = "00000000-0000-4000-8000-000000000700";
const PACKAGE_4 = "00000000-0000-4000-8000-000000000701";
const MONTHLY = "00000000-0000-4000-8000-000000000702";
const ACTIVE = "00000000-0000-0000-0000-000000000501";

class Query implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private filters: [string, unknown[]][] = [];
  private one = false;
  constructor(private db: FakeDb, private table: string) {}
  select() { return this; }
  eq(column: string, value: unknown) { this.filters.push([column, [value]]); return this; }
  in(column: string, values: unknown[]) { this.filters.push([column, values]); return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  then<A = { data: unknown; error: null }, B = never>(
    ok?: ((value: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
    fail?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    const rows = (this.db.tables[this.table] ?? []).filter((row) =>
      this.filters.every(([column, values]) => values.includes(row[column]))
    ).map((row) => this.table === "enrollments"
      ? { ...row, child: this.db.tables.children.find((child) => child.id === row.child_id) ?? null }
      : row);
    const data = structuredClone(this.one ? rows[0] ?? null : rows);
    return Promise.resolve({ data, error: null }).then(ok, fail);
  }
}

class FakeDb {
  rpcCalls: { name: string; args: Row }[] = [];
  broadcasts: Row[] = [];
  tables: Record<string, Row[]> = {
    children: [{ id: "child-a", name: "Copil A", parent_id: "parent", birth_date: "2018-01-01" }],
    courses: [{ id: "course", price_per_session: 1500, currency: "RON", eur_ron_rate_micros: null, active: true, capacity: null,
      age_from: null, age_to: null, rules_file_storage_path: null, rules_file_name: null }],
    course_packages: [
      { id: PACKAGE_8, course_id: "course", sessions: 8, price: 32000, validity: "NONE" },
      { id: PACKAGE_4, course_id: "course", sessions: 4, price: 18000, validity: "NONE" },
      { id: MONTHLY, course_id: "course", sessions: 12, price: 60000, validity: "CALENDAR_MONTH" },
    ],
    enrollments: [{ id: ACTIVE, kind: "COURSE", entity_id: "course", child_id: "child-a", status: "ACTIVE", remaining_sessions: 1 }],
    payments: [],
    payment_intent_requests: [],
  };
  from(table: string) { return new Query(this, table); }
  channel(_name: string) { return { send: (message: Row) => { this.broadcasts.push(message); return Promise.resolve(); } }; }
  removeChannel() { return Promise.resolve("ok"); }
  rpc(name: string, args: Row) {
    this.rpcCalls.push({ name, args: structuredClone(args) });
    if (name === "enrollment_offer_has_access") return Promise.resolve({ data: true, error: null });
    const ids = [name === "start_course_renewal" ? args.p_enrollment_id : "enr-new"];
    return Promise.resolve({
      data: { enrollmentId: ids[0], enrollmentIds: ids, createdEnrollmentIds: ids, paymentId: "pay-new", reused: false,
        prices: [{ childId: "child-a", amount: 1, currency: "RON" }], requiresPaymentIntent: args.p_method === "CARD" },
      error: null,
    });
  }
}

function setup() {
  const db = new FakeDb();
  const services = {
    db: db as unknown as EnrollmentServices["db"],
    getUser: () => Promise.resolve({ id: "parent" }),
    getUserRole: () => Promise.resolve("PARENT"),
  };
  const call = async (handler: (req: Request) => Promise<Response>, body: Row) => {
    try {
      return await handler(new Request("https://edge.test", { method: "POST", body: JSON.stringify(body) }));
    } catch (error) {
      if (error instanceof Response) return error;
      throw error;
    }
  };
  return {
    db,
    validate: (body: Row) => call(createValidationHandler(services), body),
    create: (body: Row) => call(createEnrollmentHandler(services), body),
  };
}

function refusal(run: () => unknown): { status: number; body: Promise<Row> } {
  try {
    run();
  } catch (error) {
    if (error instanceof Response) return { status: error.status, body: error.json() };
    throw error;
  }
  throw new Error("Expected a refusal");
}

const offers = (): CoursePackageOffer[] => [
  { id: PACKAGE_8, sessions: 8, price: 32000, validity: "NONE" },
  { id: MONTHLY, sessions: 12, price: 60000, validity: "CALENDAR_MONTH" },
];

Deno.test("a course without packages keeps the per-session choice", () => {
  equal(chooseCourseOffer([], { sessionPackageSize: 5 }), { quantity: 5, coursePackage: null }, "Sessions");
  equal(chooseCourseOffer([], {}), { quantity: 1, coursePackage: null }, "Default");
  equal(refusal(() => chooseCourseOffer([], { sessionPackageSize: 0 })).status, 400, "Zero sessions");
});

Deno.test("a course with packages sells only one of its current no-expiry packages", async () => {
  equal(chooseCourseOffer(offers(), { coursePackageId: PACKAGE_8 }).quantity, 8, "Package sessions");
  equal(chooseCourseOffer(offers(), { coursePackageId: PACKAGE_8, sessionPackageSize: 8 }).coursePackage?.price, 32000,
    "Matching size");
  const missing = refusal(() => chooseCourseOffer(offers(), { sessionPackageSize: 8 }));
  equal([missing.status, (await missing.body).code], [409, PACKAGE_CHANGED], "Per-session request on a package course");
  const unknown = refusal(() => chooseCourseOffer(offers(), { coursePackageId: PACKAGE_4 }));
  equal([unknown.status, (await unknown.body).code], [409, PACKAGE_CHANGED], "Unknown package");
  const gone = refusal(() => chooseCourseOffer([], { coursePackageId: PACKAGE_8 }));
  equal([gone.status, (await gone.body).code], [409, PACKAGE_CHANGED], "Course lost its packages");
  equal(refusal(() => chooseCourseOffer(offers(), { coursePackageId: MONTHLY })).status, 409, "Monthly waits for #698");
  equal(refusal(() => chooseCourseOffer(offers(), { coursePackageId: PACKAGE_8, sessionPackageSize: 5 })).status, 400,
    "Mismatched size");
  equal(refusal(() => chooseCourseOffer(offers(), { coursePackageId: "8 ședințe" })).status, 400, "Bad id");
});

Deno.test("a package snapshot converts the package total once and binds the package", async () => {
  const pkg = { id: PACKAGE_8, sessions: 8, price: 8000, validity: "NONE" };
  const ron = await createCoursePackageSnapshot("course", "child-a", { ...pkg, price: 32000 }, "RON", null);
  equal([ron.schemaVersion, ron.amount, ron.quantity, ron.sourcePackageAmount, ron.sourceUnitAmount], [3, 32000, 8, 32000, undefined],
    "RON package");
  const eur = await createCoursePackageSnapshot("course", "child-a", pkg, "EUR", 4975000);
  equal(eur.amount, 39800, "EUR package total converted once");
  equal(await readPriceSnapshot(structuredClone(eur)), eur, "Round trip");
  const other = await createCoursePackageSnapshot("course", "child-a", { ...pkg, id: PACKAGE_4 }, "EUR", 4975000);
  equal(other.priceVersion === eur.priceVersion, false, "Version binds the package id");
  for (const tampered of [{ ...eur, amount: 1 }, { ...eur, quantity: 9 }, { ...eur, sourceUnitAmount: 1000 },
    { ...eur, validity: "CALENDAR_MONTH" }]) {
    let refused = false;
    try {
      await readPriceSnapshot(tampered);
    } catch {
      refused = true;
    }
    equal(refused, true, `Tampered ${JSON.stringify(Object.keys(tampered).length)}`);
  }
});

Deno.test("checkout quotes a package course at the server's package price", async () => {
  const { validate, create, db } = setup();
  db.tables.enrollments = [];
  const quoted = await validate({ kind: "COURSE", entityId: "course", childIds: ["child-a"], coursePackageId: PACKAGE_8 });
  equal(quoted.status, 200, "Quote status");
  const result = (await quoted.json()).results[0];
  equal([result.eligible, result.amount, result.pricingSnapshot.packageId, result.pricingSnapshot.quantity],
    [true, 32000, PACKAGE_8, 8], "Package quote");
  const legacy = await validate({ kind: "COURSE", entityId: "course", childIds: ["child-a"], sessionPackageSize: 8 });
  equal([legacy.status, (await legacy.json()).code], [409, PACKAGE_CHANGED], "Per-session quote refused");

  const created = await create({ kind: "COURSE", entityId: "course", childIds: ["child-a"], coursePackageId: PACKAGE_8,
    paymentMethod: "CASH", priceVersions: { "child-a": result.priceVersion }, amount: 1, pricingSnapshot: { amount: 1 },
    acceptance: { termsVersion: (await import("./_shared/terms-version.ts")).TERMS_VERSION } });
  equal(created.status, 200, "Create status");
  const batch = db.rpcCalls.find((call) => call.name === "save_enrollment_batch_with_acceptance")!;
  const quote = (batch.args.p_quotes as Row[])[0];
  equal([quote.amount, (quote.snapshot as PriceSnapshot).packageId], [32000, PACKAGE_8], "Server price sent to the database");
  equal((db.broadcasts[0].payload as Row).sessionCount, 8, "Coach notification counts the package sessions");

  db.tables.course_packages[0].price = 34000;
  const stale = await create({ kind: "COURSE", entityId: "course", childIds: ["child-a"], coursePackageId: PACKAGE_8,
    paymentMethod: "CARD", priceVersions: { "child-a": result.priceVersion } });
  equal([stale.status, (await stale.json()).code], [409, "PRICE_CHANGED"], "A repriced package needs a new confirmation");
});

Deno.test("a renewal buys one of the course packages through the renewal flow", async () => {
  const { validate, create, db } = setup();
  const quoted = await validate({ renewEnrollmentId: ACTIVE, coursePackageId: PACKAGE_4 });
  equal(quoted.status, 200, "Renewal quote status");
  const renewal = (await quoted.json()).renewal;
  equal([renewal.amount, renewal.pricingSnapshot.packageId, renewal.pricingSnapshot.quantity], [18000, PACKAGE_4, 4],
    "Renewal package quote");
  const legacy = await validate({ renewEnrollmentId: ACTIVE, sessionPackageSize: 4 });
  equal([legacy.status, (await legacy.json()).code], [409, PACKAGE_CHANGED], "Per-session renewal refused");
  const created = await create({ renewEnrollmentId: ACTIVE, coursePackageId: PACKAGE_4, paymentMethod: "CASH",
    priceVersion: renewal.priceVersion, acceptance: { termsVersion: (await import("./_shared/terms-version.ts")).TERMS_VERSION } });
  equal(created.status, 200, "Renewal saved");
  const call = db.rpcCalls.find((item) => item.name === "start_course_renewal")!;
  equal([(call.args.p_quote as Row).amount, ((call.args.p_quote as Row).snapshot as PriceSnapshot).packageId], [18000, PACKAGE_4],
    "Renewal sends the package price");
  equal((db.broadcasts[0].payload as Row).sessionCount, 4, "Cash renewal notification counts the package sessions");
});
