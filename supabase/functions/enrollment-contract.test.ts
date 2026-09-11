import { createValidationHandler } from "./validate-enrollment/handler.ts";
import { createEnrollmentHandler } from "./create-enrollment/handler.ts";
import { withCors } from "./_shared/cors.ts";
import type { EnrollmentServices } from "./_shared/enrollment-pricing.ts";
import type { PriceSnapshot } from "./_shared/price-snapshot.ts";

type Row = Record<string, unknown>;
type Filter = { column: string; values: unknown[] };
type QueryResult = { data: Row | Row[] | null; error: { message: string } | null; count: number };
type Mutation = { table: string; operation: string; values: Row; filters: Filter[] };
type ChildQuote = { childId: string; eligible: boolean; amount?: number; currency?: string; priceVersion?: string; pricingSnapshot?: PriceSnapshot; name: string; reason?: string };

function equal(actual: unknown, expected: unknown, label = "Values differ") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

class FakeQuery implements PromiseLike<QueryResult> {
  private filters: Filter[] = [];
  private operation = "select";
  private values: Row = {};
  private one = false;
  private head = false;

  constructor(private db: FakeDatabase, private table: string) {}

  select(_columns?: string, options?: Row) { this.head = options?.head === true; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, values: [value] }); return this; }
  is(column: string, value: unknown) { return this.eq(column, value); }
  in(column: string, values: unknown[]) { this.filters.push({ column, values }); return this; }
  single() { this.one = true; return this; }
  insert(values: Row) { this.operation = "insert"; this.values = values; return this; }
  update(values: Row) { this.operation = "update"; this.values = values; return this; }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): QueryResult {
    if (this.head && this.db.capacityError) return { data: null, error: { message: "Capacity unavailable" }, count: 0 };
    const table = this.db.tables[this.table];
    if (!table) throw new Error(`Unexpected table ${this.table}`);
    if (this.operation !== "select") {
      this.db.attempts.push({ table: this.table, operation: this.operation, values: structuredClone(this.values), filters: structuredClone(this.filters) });
      if (this.operation === "update" && this.table === "payments") this.db.beforePaymentUpdate?.();
    }
    let rows = table.filter((row) => this.filters.every((filter) => filter.values.includes(
      filter.column === "pricing_snapshot->>priceVersion" ? (row.pricing_snapshot as PriceSnapshot)?.priceVersion : row[filter.column],
    )));
    if (this.operation === "insert") {
      const inserted = { id: `${this.table}-${++this.db.sequence}`, ...this.values };
      table.push(inserted);
      rows = [inserted];
      this.db.writes.push({ table: this.table, operation: this.operation, values: structuredClone(inserted), filters: [] });
    } else if (this.operation === "update") {
      for (const row of rows) {
        Object.assign(row, this.values);
        this.db.writes.push({ table: this.table, operation: this.operation, values: structuredClone(this.values), filters: structuredClone(this.filters) });
      }
    }
    if (this.one && rows.length !== 1) return { data: null, error: { message: "Expected one row" }, count: rows.length };
    return { data: structuredClone(this.one ? rows[0] : rows), error: null, count: rows.length };
  }
}

class FakeDatabase {
  sequence = 0;
  attempts: Mutation[] = [];
  writes: Mutation[] = [];
  rpcCalls: { name: string; childId: string; campId: string }[] = [];
  prices: Record<string, number | null> = { "child-a": 12000, "child-b": 18000 };
  rpcErrorChild: string | null = null;
  capacityError = false;
  beforePaymentUpdate?: () => void;
  tables: Record<string, Row[]> = {
    children: [
      { id: "child-a", name: "Copil A", parent_id: "parent", birth_date: "2018-09-01" },
      { id: "child-b", name: "Copil B", parent_id: "parent", birth_date: "2014-09-01" },
    ],
    camps: [{ id: "camp", price: 99999, pricing_mode: "by_age", currency: "RON", capacity: null, allow_cash: true }],
    courses: [{ id: "course", price_per_session: 1500, currency: "RON", capacity: null, active: true, age_from: null, age_to: null }],
    activities: [{ id: "activity", price: 2500, currency: "RON", capacity: null, active: true }],
    enrollments: [],
    payments: [],
  };

  from(table: string) { return new FakeQuery(this, table); }
  channel(_name: string) { return { send: (_message: unknown) => Promise.resolve() }; }

  rpc(name: string, args: { p_child_id: string; p_camp_id: string }) {
    equal(name, "enrollment_camp_offer", "Server pricing RPC");
    this.rpcCalls.push({ name, childId: args.p_child_id, campId: args.p_camp_id });
    return Promise.resolve({
      data: { amount: this.prices[args.p_child_id] ?? null, currency: this.tables.camps[0].currency,
        eur_ron_rate_micros: this.tables.camps[0].eur_ron_rate_micros ?? null },
      error: this.rpcErrorChild === args.p_child_id ? { message: "Pricing unavailable" } : null,
    });
  }
}

function fixture(role = "PARENT", kind = "CAMP", sessionPackageSize = 1) {
  const db = new FakeDatabase();
  const services: EnrollmentServices = {
    db: db as unknown as EnrollmentServices["db"],
    getUser: () => Promise.resolve({ id: "parent" }),
    getUserRole: () => Promise.resolve(role),
  };
  const validateHandler = withCors(createValidationHandler(services));
  const enrollHandler = withCors(createEnrollmentHandler(services));
  const request = (body: Row) => new Request("http://localhost/enrollment-contract", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return {
    db,
    validate: (childIds = ["child-a", "child-b"], extra: Row = {}) => validateHandler(request({ kind, entityId: kind.toLowerCase(), childIds, sessionPackageSize, ...extra })),
    create: (childIds = ["child-a", "child-b"], priceVersions: Record<string, string> = {}, extra: Row = {}) =>
      enrollHandler(request({ kind, entityId: kind.toLowerCase(), childIds, sessionPackageSize, paymentMethod: "CARD", priceVersions, ...extra })),
  };
}

type Fixture = ReturnType<typeof fixture>;

async function quote(context: Fixture, childIds = ["child-a", "child-b"]) {
  const response = await context.validate(childIds);
  equal(response.status, 200);
  const body = await response.json() as { results: ChildQuote[] };
  equal(context.db.attempts.length, 0, "Validation must never mutate data");
  return {
    results: body.results,
    versions: Object.fromEntries(body.results.filter((row) => row.priceVersion).map((row) => [row.childId, row.priceVersion!])),
  };
}

function pending(context: Fixture, status = "PENDING", gateway: string | null = null) {
  context.db.tables.enrollments.push({ id: "draft-a", child_id: "child-a", kind: "CAMP", entity_id: "camp", status: "PENDING" });
  context.db.tables.payments.push({
    id: "payment-a", enrollment_id: "draft-a", status, gateway_txn_id: gateway,
    amount: 7000, currency: "RON", method: "CARD",
    pricing_snapshot: null,
  });
}

Deno.test("validation prices each owned child on the server and returns opaque versions without writes", async () => {
  const context = fixture();
  const result = await quote(context);
  equal(result.results.map((row) => [row.childId, row.amount, row.currency, row.eligible]), [
    ["child-a", 12000, "RON", true], ["child-b", 18000, "RON", true],
  ]);
  assert(result.results.every((row) => /^[a-f0-9]{64}$/.test(row.priceVersion ?? "")), "Each child needs a SHA-256 version");
  equal(context.db.rpcCalls.map((call) => [call.childId, call.campId]), [["child-a", "camp"], ["child-b", "camp"]]);
});

for (const paymentMethod of ["CARD", "CASH"]) {
  Deno.test(`creation persists distinct per-child RPC amounts for ${paymentMethod} and ignores submitted amounts`, async () => {
    const context = fixture();
    const quoted = await quote(context);
    const response = await context.create(undefined, quoted.versions, { paymentMethod, amount: 1, prices: { "child-a": 1 } });
    equal(response.status, 200);
    const body = await response.json();
    equal(body.enrollmentIds.length, 2);
    equal(body.requiresPaymentIntent, paymentMethod === "CARD");
    for (const [childId, expectedAmount] of [["child-a", 12000], ["child-b", 18000]]) {
      const enrollment = context.db.tables.enrollments.find((row) => row.child_id === childId);
      assert(enrollment, "Each child must have its own enrollment");
      const payment = context.db.tables.payments.find((row) => row.enrollment_id === enrollment.id);
      equal([payment?.amount, payment?.currency, payment?.method], [expectedAmount, "RON", paymentMethod]);
    }
    equal(body.prices.map((row: Row) => [row.childId, row.amount]), [["child-a", 12000], ["child-b", 18000]]);
    equal(context.db.rpcCalls.length, 4, "Creation must independently recompute both prices");
  });
}

Deno.test("single-mode camps still use the authoritative RPC result for every child", async () => {
  const context = fixture();
  context.db.tables.camps[0].pricing_mode = "single";
  context.db.prices = { "child-a": 25000, "child-b": 25000 };
  const quoted = await quote(context);
  equal((await context.create(undefined, quoted.versions)).status, 200);
  equal(context.db.tables.payments.map((row) => row.amount), [25000, 25000]);
});

Deno.test("an unmatched age rejects the child and the complete creation batch before writes", async () => {
  const context = fixture();
  context.db.prices["child-b"] = null;
  const quoted = await quote(context);
  equal(quoted.results.map((row) => row.eligible), [true, false]);
  assert(quoted.results[1].reason?.includes("categoria") || quoted.results[1].reason?.includes("categorie"), "Explain missing price category");
  equal((await context.create(undefined, quoted.versions)).status, 409);
  equal(context.db.attempts, []);
});

Deno.test("RPC failures return 500 from both endpoints before any creation writes", async () => {
  const context = fixture();
  context.db.rpcErrorChild = "child-b";
  equal((await context.validate()).status, 500);
  equal((await context.create()).status, 500);
  equal(context.db.attempts, []);
});

Deno.test("foreign children are hidden and excluded from pricing, and creation is forbidden", async () => {
  const context = fixture();
  context.db.tables.children[1].parent_id = "other-parent";
  const quoted = await quote(context);
  equal([quoted.results[1].eligible, quoted.results[1].name, quoted.results[1].amount], [false, "—", undefined]);
  equal(context.db.rpcCalls.map((call) => call.childId), ["child-a"]);
  equal((await context.create(undefined, quoted.versions)).status, 403);
  equal(context.db.attempts, []);
});

Deno.test("a missing child rejects the complete creation request without partial enrollment", async () => {
  const context = fixture();
  const ids = ["child-a", "missing"];
  const quoted = await quote(context, ids);
  equal(quoted.results[1].eligible, false);
  equal((await context.create(ids, quoted.versions)).status, 400);
  equal(context.db.attempts, []);
});

Deno.test("duplicate child IDs are rejected by both endpoints before pricing or writes", async () => {
  const context = fixture();
  equal((await context.validate(["child-a", "child-a"])).status, 400);
  equal((await context.create(["child-a", "child-a"])).status, 400);
  equal(context.db.rpcCalls, []);
  equal(context.db.attempts, []);
});

for (const status of ["SUCCEEDED", "REFUNDED"]) {
  Deno.test(`${status} payments are never repriced or reset`, async () => {
    const context = fixture();
    pending(context, status, "pi_existing");
    const original = structuredClone(context.db.tables.payments);
    const quoted = await quote(context, ["child-a"]);
    equal(quoted.results[0].eligible, false);
    equal((await context.create(["child-a"], quoted.versions)).status, 409);
    equal(context.db.tables.payments, original);
    equal(context.db.attempts, []);
    equal(context.db.rpcCalls, []);
  });
}

Deno.test("pending gateway payments preserve stored amounts despite changed camp pricing", async () => {
  const context = fixture();
  pending(context, "PENDING", "pi_existing");
  context.db.prices["child-a"] = 50000;
  const original = structuredClone(context.db.tables.payments);
  const quoted = await quote(context, ["child-a"]);
  equal(quoted.results[0].amount, 7000);
  const response = await context.create(["child-a"], quoted.versions);
  equal(response.status, 200);
  equal((await response.json()).prices, [{ childId: "child-a", amount: 7000, currency: "RON" }]);
  equal(context.db.tables.payments, original);
  equal(context.db.attempts, []);
  equal(context.db.rpcCalls, []);
});

Deno.test("pending payments without an intent reprice through conditional update", async () => {
  const context = fixture();
  pending(context);
  const quoted = await quote(context, ["child-a"]);
  equal(quoted.results[0].amount, 12000);
  equal((await context.create(["child-a"], quoted.versions)).status, 200);
  equal(context.db.tables.payments[0].amount, 12000);
  equal(context.db.tables.enrollments.length, 1);
  equal(context.db.writes.length, 1);
  equal(context.db.attempts[0].filters, [
    { column: "id", values: ["payment-a"] },
    { column: "status", values: ["PENDING"] },
    { column: "gateway_txn_id", values: [null] },
    { column: "pricing_snapshot", values: [null] },
  ]);
});

for (const concurrentChange of ["payment succeeded", "intent attached"]) {
  Deno.test(`a concurrent ${concurrentChange} makes the payment CAS fail with 409`, async () => {
    const context = fixture();
    pending(context);
    const quoted = await quote(context, ["child-a"]);
    context.db.beforePaymentUpdate = () => {
      if (concurrentChange === "payment succeeded") context.db.tables.payments[0].status = "SUCCEEDED";
      else context.db.tables.payments[0].gateway_txn_id = "pi_concurrent";
    };
    equal((await context.create(["child-a"], quoted.versions)).status, 409);
    equal(context.db.tables.payments[0].amount, 7000);
    equal(context.db.writes, []);
    equal(context.db.attempts.length, 1);
  });
}

Deno.test("a changed price version rejects the entire batch before any mutation", async () => {
  const context = fixture();
  const quoted = await quote(context);
  context.db.prices["child-b"] = 19000;
  const response = await context.create(undefined, quoted.versions);
  equal(response.status, 409);
  equal((await response.json()).code, "PRICE_CHANGED");
  equal(context.db.attempts, []);
});

Deno.test("missing price versions cannot bypass server quote confirmation", async () => {
  const context = fixture();
  const response = await context.create();
  equal(response.status, 409);
  equal((await response.json()).code, "PRICE_CHANGED");
  equal(context.db.attempts, []);
});

Deno.test("nonparent callers cannot validate or create enrollments", async () => {
  const context = fixture("COACH");
  equal((await context.validate()).status, 403);
  equal((await context.create()).status, 403);
  equal(context.db.rpcCalls, []);
  equal(context.db.attempts, []);
});

Deno.test("capacity read failures block validation and creation without writes", async () => {
  const context = fixture();
  context.db.tables.camps[0].capacity = 10;
  const quoted = await quote(context);
  context.db.capacityError = true;
  equal((await context.validate()).status, 500);
  equal((await context.create(undefined, quoted.versions)).status, 500);
  equal(context.db.attempts, []);
});

for (const kind of ["COURSE", "ACTIVITY", "CAMP"]) {
  for (const currency of ["RON", "EUR"]) {
    for (const paymentMethod of ["CARD", "CASH"]) {
      Deno.test(`${kind} ${currency} ${paymentMethod} confirms authoritative RON and records source pricing`, async () => {
        const quantity = kind === "COURSE" ? 3 : 1;
        const context = fixture("PARENT", kind, quantity);
        const table = kind === "ACTIVITY" ? "activities" : `${kind.toLowerCase()}s`;
        Object.assign(context.db.tables[table][0], { currency, eur_ron_rate_micros: currency === "EUR" ? 5123456 : null });
        const quoted = await quote(context);
        const response = await context.create(undefined, quoted.versions, {
          paymentMethod, amount: 1, currency: "USD", eurRonRateMicros: 1, pricingSnapshot: { amount: 1 },
        });
        equal(response.status, 200);
        const units = kind === "COURSE" ? [1500, 1500] : kind === "ACTIVITY" ? [2500, 2500] : [12000, 18000];
        for (let i = 0; i < 2; i++) {
          const expected = currency === "RON" ? units[i] * quantity : Math.floor((units[i] * quantity * 5123456 + 500000) / 1000000);
          const payment = context.db.tables.payments[i];
          const snapshot = payment.pricing_snapshot as PriceSnapshot;
          equal([payment.amount, payment.currency, snapshot.sourceUnitAmount, snapshot.sourceCurrency, snapshot.quantity],
            [expected, "RON", units[i], currency, quantity]);
          equal(snapshot, quoted.results[i].pricingSnapshot);
        }
      });
    }
  }

  Deno.test(`${kind} refuses missing or changed versions before writes`, async () => {
    const context = fixture("PARENT", kind);
    equal((await context.create()).status, 409);
    const quoted = await quote(context);
    const table = kind === "ACTIVITY" ? "activities" : `${kind.toLowerCase()}s`;
    Object.assign(context.db.tables[table][0], { currency: "EUR", eur_ron_rate_micros: 5000000 });
    const response = await context.create(undefined, quoted.versions);
    equal(response.status, 409);
    equal((await response.json()).code, "PRICE_CHANGED");
    equal(context.db.attempts, []);
  });

  Deno.test(`${kind} rejects invalid EUR rates on validation and creation`, async () => {
    for (const rate of [null, 0, -1, 5.12, "5.12"]) {
      const context = fixture("PARENT", kind);
      const table = kind === "ACTIVITY" ? "activities" : `${kind.toLowerCase()}s`;
      Object.assign(context.db.tables[table][0], { currency: "EUR", eur_ron_rate_micros: rate });
      equal((await context.validate()).status, 500);
      equal((await context.create()).status, 500);
      equal(context.db.attempts, []);
    }
  });

  Deno.test(`${kind} retry preserves accepted pricing with or without a gateway after organizer edits`, async () => {
    const context = fixture("PARENT", kind);
    const quoted = await quote(context);
    equal((await context.create(undefined, quoted.versions)).status, 200);
    const table = kind === "ACTIVITY" ? "activities" : `${kind.toLowerCase()}s`;
    Object.assign(context.db.tables[table][0], { currency: "EUR", eur_ron_rate_micros: 7500000, price: 55555, price_per_session: 9999 });
    context.db.prices = { "child-a": 55555, "child-b": 99999 };
    for (const gateway of [null, "pi_saved"]) {
      for (const payment of context.db.tables.payments) payment.gateway_txn_id = gateway;
      const original = structuredClone(context.db.tables.payments);
      context.db.attempts = [];
      const repeated = await quote(context);
      equal(repeated.versions, quoted.versions);
      equal((await context.create(undefined, repeated.versions)).status, 200);
      equal(context.db.tables.payments, original);
      equal(context.db.attempts, []);
    }
  });

  Deno.test(`${kind} rejects processed payments and foreign children before writes`, async () => {
    for (const status of ["SUCCEEDED", "REFUNDED"]) {
      const context = fixture("PARENT", kind);
      const quoted = await quote(context);
      equal((await context.create(undefined, quoted.versions)).status, 200);
      context.db.tables.payments[0].status = status;
      context.db.attempts = [];
      equal((await context.create(undefined, quoted.versions)).status, 409);
      equal(context.db.attempts, []);
    }
    const context = fixture("PARENT", kind);
    context.db.tables.children[0].parent_id = "stranger";
    const quoted = await quote(context);
    equal(quoted.results[0].name, "—");
    equal(quoted.results[0].pricingSnapshot, undefined);
    equal((await context.create(undefined, quoted.versions)).status, 403);
    equal(context.db.attempts, []);
  });
}

Deno.test("course package changes require reconfirmation and cannot reprice an accepted snapshot", async () => {
  const context = fixture("PARENT", "COURSE", 3);
  const quoted = await quote(context);
  equal((await context.create(undefined, quoted.versions, { sessionPackageSize: 4 })).status, 409);
  equal(context.db.attempts, []);
  equal((await context.create(undefined, quoted.versions)).status, 200);
  const original = structuredClone(context.db.tables.payments);
  equal((await context.create(undefined, quoted.versions, { sessionPackageSize: 4 })).status, 409);
  equal(context.db.tables.payments, original);
});

Deno.test("invalid package counts are rejected by both endpoints", async () => {
  for (const kind of ["COURSE", "ACTIVITY", "CAMP"]) {
    const context = fixture("PARENT", kind);
    for (const sessionPackageSize of [null, 0, -1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1]) {
      equal((await context.validate(undefined, { sessionPackageSize })).status, 400);
      equal((await context.create(undefined, {}, { sessionPackageSize })).status, 400);
    }
    equal(context.db.attempts, []);
  }
});

Deno.test("a changed rate invalidates confirmation even if rounding leaves the RON amount unchanged", async () => {
  const context = fixture("PARENT", "ACTIVITY");
  Object.assign(context.db.tables.activities[0], { price: 1, currency: "EUR", eur_ron_rate_micros: 5000000 });
  const quoted = await quote(context);
  context.db.tables.activities[0].eur_ron_rate_micros = 5000001;
  equal((await context.create(undefined, quoted.versions)).status, 409);
  equal(context.db.attempts, []);
});

for (const status of ["PENDING", "FAILED", "CANCELLED"]) {
  Deno.test(`accepted ${status} cash payment retries by card with new billing and unchanged pricing`, async () => {
    const context = fixture();
    const quoted = await quote(context);
    equal((await context.create(undefined, quoted.versions, { paymentMethod: "CASH" })).status, 200);
    for (const payment of context.db.tables.payments) {
      payment.status = status;
      payment.gateway_txn_id = null;
    }
    const snapshots = context.db.tables.payments.map((row) => structuredClone(row.pricing_snapshot));
    const billingDetails = { name: "Test Parent", email: "parent@example.test", addressLine1: "Test", city: "Test", postalCode: "123" };
    equal((await context.create(undefined, quoted.versions, { billingDetails })).status, 200);
    equal(context.db.tables.payments.map((row) => [row.method, row.status, row.billing_name]),
      [["CARD", "PENDING", "Test Parent"], ["CARD", "PENDING", "Test Parent"]]);
    equal(context.db.tables.payments.map((row) => row.pricing_snapshot), snapshots);
  });
}

Deno.test("concurrent snapshot retry cannot overwrite a processed payment", async () => {
  const context = fixture();
  const quoted = await quote(context);
  equal((await context.create(undefined, quoted.versions, { paymentMethod: "CASH" })).status, 200);
  for (const payment of context.db.tables.payments) payment.gateway_txn_id = null;
  context.db.beforePaymentUpdate = () => { context.db.tables.payments[0].status = "SUCCEEDED"; };
  equal((await context.create(undefined, quoted.versions)).status, 409);
  equal(context.db.tables.payments[0].status, "SUCCEEDED");
  equal(context.db.tables.payments[0].method, "CASH");
});
