import { TERMS_VERSION } from "./_shared/terms-version.ts";
import { createValidationHandler } from "./validate-enrollment/handler.ts";
import { createEnrollmentHandler } from "./create-enrollment/handler.ts";
import { createPriceSnapshot } from "./_shared/price-snapshot.ts";
import type { EnrollmentServices } from "./_shared/enrollment-pricing.ts";

type Row = Record<string, unknown>;

function equal(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private filters: [string, unknown[]][] = [];
  private ranges: ((row: Row) => boolean)[] = [];
  private one = false;
  constructor(private db: FakeDb, private table: string) {}
  select() { return this; }
  eq(column: string, value: unknown) { this.filters.push([column, [value]]); return this; }
  in(column: string, values: unknown[]) { this.filters.push([column, values]); return this; }
  lte(column: string, value: string) { this.ranges.push((row) => String(row[column]) <= value); return this; }
  gte(column: string, value: string) { this.ranges.push((row) => String(row[column]) >= value); return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  then<A = { data: unknown; error: null }, B = never>(
    ok?: ((value: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
    fail?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    const rows = (this.db.tables[this.table] ?? []).filter((row) =>
      this.filters.every(([column, values]) => values.includes(row[column])) &&
      this.ranges.every((match) => match(row))
    ).map((row) => this.table === "enrollments"
      ? { ...row, child: this.db.tables.children.find((child) => child.id === row.child_id) ?? null }
      : row);
    const data = structuredClone(this.one ? rows[0] ?? null : rows);
    return Promise.resolve({ data, error: null }).then(ok, fail);
  }
}

class FakeDb {
  access = true;
  rpcCalls: { name: string; args: Row }[] = [];
  rpcError: { code: string; message: string; details?: string } | null = null;
  broadcasts: unknown[] = [];
  tables: Record<string, Row[]> = {
    children: [
      { id: "child-a", name: "Copil A", parent_id: "parent" },
      { id: "child-x", name: "Copil X", parent_id: "other" },
    ],
    courses: [{ id: "course", price_per_session: 1500, currency: "RON", eur_ron_rate_micros: null, active: true,
      rules_file_storage_path: null, rules_file_name: null }],
    enrollments: [
      { id: "enr-active", kind: "COURSE", entity_id: "course", child_id: "child-a", status: "ACTIVE", remaining_sessions: 0 },
      { id: "enr-pending", kind: "COURSE", entity_id: "course", child_id: "child-a", status: "PENDING", remaining_sessions: 0 },
      { id: "enr-other", kind: "COURSE", entity_id: "course", child_id: "child-x", status: "ACTIVE", remaining_sessions: 2 },
    ],
    payments: [],
    payment_intent_requests: [],
  };
  from(table: string) { return new Query(this, table); }
  channel(_name: string) { return { send: (message: unknown) => { this.broadcasts.push(message); return Promise.resolve(); } }; }
  removeChannel() { return Promise.resolve("ok"); }
  rpc(name: string, args: Row) {
    this.rpcCalls.push({ name, args: structuredClone(args) });
    if (name === "enrollment_offer_has_access") return Promise.resolve({ data: this.access, error: null });
    if (this.rpcError) return Promise.resolve({ data: null, error: this.rpcError });
    return Promise.resolve({
      data: { enrollmentId: args.p_enrollment_id, enrollmentIds: [args.p_enrollment_id], paymentId: "pay-new", sessions: 5,
        reused: false, prices: [{ childId: "child-a", amount: 7500, currency: "RON" }], requiresPaymentIntent: args.p_method === "CARD" },
      error: null,
    });
  }
}

const UUIDS: Record<string, string> = {
  "enr-active": "00000000-0000-0000-0000-000000000501",
  "enr-pending": "00000000-0000-0000-0000-000000000502",
  "enr-other": "00000000-0000-0000-0000-000000000503",
};

function setup() {
  const db = new FakeDb();
  for (const row of db.tables.enrollments) row.id = UUIDS[String(row.id)];
  const services = {
    db: db as unknown as EnrollmentServices["db"],
    getUser: () => Promise.resolve({ id: "parent" }),
    getUserRole: () => Promise.resolve("PARENT"),
  };
  const call = (handler: (req: Request) => Promise<Response>, body: Row) =>
    handler(new Request("https://edge.test", { method: "POST", body: JSON.stringify(body) }));
  return {
    db,
    validate: (body: Row) => call(createValidationHandler(services), body),
    create: (body: Row) => call(createEnrollmentHandler(services), body),
  };
}

const billing = { name: "Ana Părinte", email: "ana@example.test", addressLine1: "Str. Test 1", city: "Timișoara", postalCode: "300001" };

async function settled(promise: Promise<Response>) {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}

Deno.test("an active course enrollment gets a renewal quote at today's price per session", async () => {
  const { validate } = setup();
  const response = await validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5 });
  equal(response.status, 200, "Renewal quote status");
  const body = await response.json();
  const expected = await createPriceSnapshot("COURSE", "course", "child-a", 1500, "RON", null, 5);
  equal(body.renewal.eligible, true, "Renewal is allowed");
  equal(body.renewal.amount, 7500, "Five sessions cost five times the price");
  equal(body.renewal.priceVersion, expected.priceVersion, "Same snapshot as the server will accept");
  equal(body.renewal.name, "Copil A", "Child name");
  equal(body.renewal.openPayment, null, "No open payment");
});

Deno.test("a renewal is refused for another family, an unpaid enrollment or an invalid quantity", async () => {
  const { validate } = setup();
  equal((await settled(validate({ renewEnrollmentId: UUIDS["enr-other"], sessionPackageSize: 5 }))).status, 403, "Other parent");
  equal((await settled(validate({ renewEnrollmentId: UUIDS["enr-pending"], sessionPackageSize: 5 }))).status, 409, "Pending enrollment");
  equal((await settled(validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 0 }))).status, 400, "Zero sessions");
  equal((await settled(validate({ renewEnrollmentId: "nu-e-uuid", sessionPackageSize: 5 }))).status, 400, "Bad id");
});

Deno.test("a stale price never reaches the database", async () => {
  const { create, db } = setup();
  const response = await settled(create({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5, paymentMethod: "CASH",
    priceVersion: "vechi", acceptance: { termsVersion: TERMS_VERSION, rulesFingerprint: "none" } }));
  equal(response.status, 409, "Stale price status");
  equal((await response.json()).code, "PRICE_CHANGED", "Stale price code");
  equal(db.rpcCalls.some((call) => call.name === "start_course_renewal"), false, "No renewal written");
});

Deno.test("a cash renewal sends the server quote and notifies the organizer", async () => {
  const { create, validate, db } = setup();
  const quote = (await (await validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5 })).json()).renewal;
  const response = await create({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5, paymentMethod: "CASH",
    priceVersion: quote.priceVersion, acceptance: { termsVersion: TERMS_VERSION, rulesFingerprint: "none" } });
  equal(response.status, 200, "Cash renewal status");
  const body = await response.json();
  equal(body.paymentId, "pay-new", "Payment id returned");
  equal(body.enrollmentIds, [UUIDS["enr-active"]], "Same enrollment");
  equal("reused" in body, false, "Internal flags stay on the server");
  const call = db.rpcCalls.find((item) => item.name === "start_course_renewal")!;
  equal(call.args.p_method, "CASH", "Method");
  equal(call.args.p_billing, null, "No billing for cash");
  equal((call.args.p_quote as Row).amount, 7500, "Server amount");
  equal(((call.args.p_quote as Row).snapshot as Row).quantity, 5, "Server quantity");
  equal((call.args.p_acceptance as Row).termsVersion, TERMS_VERSION, "Acceptance recorded");
  equal(db.broadcasts.length, 1, "Organizer notified once");
});

Deno.test("a card renewal needs billing details", async () => {
  const { create, validate, db } = setup();
  const quote = (await (await validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 4 })).json()).renewal;
  const base = { renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 4, paymentMethod: "CARD", priceVersion: quote.priceVersion,
    acceptance: { termsVersion: TERMS_VERSION, rulesFingerprint: "none" } };
  equal((await create(base)).status, 400, "Missing billing");
  const response = await create({ ...base, billingDetails: billing });
  equal(response.status, 200, "Card renewal status");
  equal((await response.json()).requiresPaymentIntent, true, "Card checkout follows");
  equal(db.rpcCalls.find((item) => item.name === "start_course_renewal")!.args.p_billing, billing, "Billing sent");
  equal(db.broadcasts.length, 0, "No cash notification for card");
});

Deno.test("an offer without platform access and database refusals keep their codes", async () => {
  const { create, validate, db } = setup();
  const quote = (await (await validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5 })).json()).renewal;
  const body = { renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5, paymentMethod: "CASH", priceVersion: quote.priceVersion,
    acceptance: { termsVersion: TERMS_VERSION, rulesFingerprint: "none" } };
  db.rpcError = { code: "23514", message: "Ai deja o plată cash în așteptare la acest curs.", details: "RENEWAL_IN_PROGRESS" };
  const refused = await create(body);
  equal(refused.status, 409, "Open payment status");
  equal((await refused.json()).code, "RENEWAL_IN_PROGRESS", "Open payment code");
  db.access = false;
  const inactive = await create(body);
  equal(inactive.status, 409, "No access status");
  equal((await inactive.json()).code, "SUBSCRIPTION_INACTIVE", "No access code");
  const quoteWithoutAccess = await (await validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5 })).json();
  equal(quoteWithoutAccess.renewal.eligible, false, "Quote shows the offer is closed");
  db.access = true;
  db.rpcError = { code: "23514", message: "new row violates check constraint \"payments_amount_check\"" };
  const raw = await create(body);
  equal(raw.status, 409, "Unknown refusal status");
  equal(await raw.json(), { error: "Nu am putut salva cumpărarea. Reîncearcă." }, "Database text stays on the server");
});

Deno.test("more than 100 sessions at once is refused before any write", async () => {
  const { create, validate, db } = setup();
  const quote = await validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 101 });
  equal(quote.status, 400, "Quote status");
  equal((await quote.json()).error, "Poți cumpăra cel mult 100 de ședințe odată.", "Quote message");
  const created = await create({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 101, paymentMethod: "CASH",
    priceVersion: "x", acceptance: { termsVersion: TERMS_VERSION, rulesFingerprint: "none" } });
  equal(created.status, 400, "Create status");
  equal(db.rpcCalls.filter((call) => call.name === "start_course_renewal").length, 0, "No database write");
});

Deno.test("an open card payment with a prepared Stripe intent counts as started", async () => {
  const { validate, db } = setup();
  db.tables.payments.push({ id: "pay-open", enrollment_id: UUIDS["enr-active"], method: "CARD", status: "PENDING", amount: 7500,
    gateway_txn_id: null, pricing_snapshot: { quantity: 5 } });
  const unstarted = (await (await validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5 })).json()).renewal;
  equal(unstarted.openPayment.started, false, "No Stripe request yet");
  db.tables.payment_intent_requests.push({ id: "pay-open" });
  const prepared = (await (await validate({ renewEnrollmentId: UUIDS["enr-active"], sessionPackageSize: 5 })).json()).renewal;
  equal(prepared.openPayment.started, true, "Prepared intent");
});
