import { createSyncHandler } from "./handler.ts";
import {
  type CatalogPrice,
  type CatalogProduct,
  type NewPrice,
  type PlanStore,
  type StripeCatalog,
  stripeModeFromKey,
  type SubscriptionPlan,
  syncSubscriptionPrices,
} from "./sync.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message} expected ${e}, got ${a}`);
}

const SPEC_PLANS: SubscriptionPlan[] = [
  { code: "CLUB_PRO", subscriber_type: "CLUB", name: "Club Pro", price_bani: 59900, active: true, stripe_price_id: null },
  { code: "COACH", subscriber_type: "COACH", name: "Antrenor", price_bani: 10000, active: true, stripe_price_id: null },
  { code: "CLUB", subscriber_type: "CLUB", name: "Club", price_bani: 34900, active: true, stripe_price_id: null },
  { code: "CLUB_START", subscriber_type: "CLUB", name: "Club Start", price_bani: 19900, active: true, stripe_price_id: null },
];

class FakeStripe implements StripeCatalog {
  products = new Map<string, CatalogProduct>();
  prices: (CatalogPrice & { lookup_key: string | null; metadata: Record<string, string> })[] = [];
  calls: string[] = [];
  private seq = 0;

  async retrieveProduct(id: string) {
    this.calls.push(`retrieveProduct:${id}`);
    const product = this.products.get(id);
    return product ? { ...product, metadata: { ...product.metadata } } : null;
  }

  async createProduct(product: CatalogProduct) {
    this.calls.push(`createProduct:${product.id}`);
    if (this.products.has(product.id)) throw new Error("resource_already_exists");
    this.products.set(product.id, { ...product });
    return product;
  }

  async updateProduct(id: string, changes: Partial<Omit<CatalogProduct, "id">>) {
    this.calls.push(`updateProduct:${id}`);
    const next = { ...this.products.get(id)!, ...changes } as CatalogProduct;
    this.products.set(id, next);
    return next;
  }

  async findPriceByLookupKey(lookupKey: string) {
    return this.prices.find((price) => price.lookup_key === lookupKey) ?? null;
  }

  async createPrice(price: NewPrice) {
    this.calls.push(`createPrice:${price.lookup_key}:${price.unit_amount}`);
    assert(this.products.has(price.product), "price created before its product");
    const holder = this.prices.find((p) => p.lookup_key === price.lookup_key);
    if (holder && !price.transfer_lookup_key) throw new Error("lookup_key already in use");
    if (holder) holder.lookup_key = null;
    const created = {
      id: `price_fake_${++this.seq}`,
      product: price.product,
      currency: price.currency,
      unit_amount: price.unit_amount,
      interval: price.interval,
      interval_count: 1,
      tax_behavior: price.tax_behavior,
      active: true,
      lookup_key: price.lookup_key,
      metadata: price.metadata,
    };
    this.prices.push(created);
    return created;
  }

  async archivePrice(id: string) {
    this.calls.push(`archivePrice:${id}`);
    this.prices.find((price) => price.id === id)!.active = false;
  }
}

function memoryStore(plans: SubscriptionPlan[]): PlanStore & { rows: SubscriptionPlan[]; writes: string[] } {
  const rows = plans.map((plan) => ({ ...plan }));
  const writes: string[] = [];
  return {
    rows,
    writes,
    async listPlans() {
      return rows.map((row) => ({ ...row }));
    },
    async setStripePriceId(code, priceId) {
      writes.push(code);
      rows.find((row) => row.code === code)!.stripe_price_id = priceId;
    },
  };
}

Deno.test("first run creates four products and monthly RON prices without VAT and stores their ids", async () => {
  const stripe = new FakeStripe();
  const store = memoryStore(SPEC_PLANS);
  const report = await syncSubscriptionPrices("test", stripe, store);

  assertEquals(report.mode, "test");
  assertEquals(report.plans.map((p) => p.code), ["COACH", "CLUB_START", "CLUB", "CLUB_PRO"]);
  assertEquals(report.plans.map((p) => p.unit_amount), [10000, 19900, 34900, 59900]);
  assert(report.plans.every((p) => p.product === "created" && p.price === "created" && p.plan_row === "updated"));
  assertEquals([...stripe.products.keys()].sort(), [
    "motion_sub_club",
    "motion_sub_club_pro",
    "motion_sub_club_start",
    "motion_sub_coach",
  ]);
  for (const price of stripe.prices) {
    assertEquals([price.currency, price.interval, price.interval_count, price.tax_behavior], ["ron", "month", 1, "inclusive"]);
    assertEquals(price.product, `motion_sub_${price.lookup_key!.toLowerCase()}`);
  }
  for (const row of store.rows) {
    const price = stripe.prices.find((p) => p.id === row.stripe_price_id)!;
    assertEquals([price.lookup_key, price.unit_amount], [row.code, row.price_bani], row.code);
  }
  assertEquals(stripe.products.get("motion_sub_coach")!.name, "Motion România · Antrenor");
  assertEquals(stripe.products.get("motion_sub_club_start")!.metadata, { plan_code: "CLUB_START", subscriber_type: "CLUB" });
});

Deno.test("second run creates nothing and writes nothing", async () => {
  const stripe = new FakeStripe();
  const store = memoryStore(SPEC_PLANS);
  await syncSubscriptionPrices("test", stripe, store);
  const pricesBefore = stripe.prices.length;
  store.writes.length = 0;
  stripe.calls.length = 0;

  const report = await syncSubscriptionPrices("test", stripe, store);
  assertEquals(stripe.prices.length, pricesBefore);
  assertEquals(store.writes, []);
  assert(stripe.calls.every((call) => call.startsWith("retrieveProduct:")), stripe.calls.join(","));
  assert(report.plans.every((p) => p.product === "unchanged" && p.price === "unchanged" && p.plan_row === "unchanged"));
});

Deno.test("a lost plan-row id is restored from the lookup key without a new price", async () => {
  const stripe = new FakeStripe();
  const store = memoryStore(SPEC_PLANS);
  await syncSubscriptionPrices("test", stripe, store);
  const coachId = store.rows.find((r) => r.code === "COACH")!.stripe_price_id;
  store.rows.find((r) => r.code === "COACH")!.stripe_price_id = null;
  store.writes.length = 0;

  const report = await syncSubscriptionPrices("test", stripe, store);
  assertEquals(stripe.prices.length, 4);
  assertEquals(store.writes, ["COACH"]);
  assertEquals(store.rows.find((r) => r.code === "COACH")!.stripe_price_id, coachId);
  assertEquals(report.plans.find((p) => p.code === "COACH")!.price, "unchanged");
});

Deno.test("a changed price in the plan table creates a new price, moves the lookup key and archives the old one", async () => {
  const stripe = new FakeStripe();
  const store = memoryStore(SPEC_PLANS);
  await syncSubscriptionPrices("test", stripe, store);
  const oldId = store.rows.find((r) => r.code === "CLUB")!.stripe_price_id!;
  store.rows.find((r) => r.code === "CLUB")!.price_bani = 37900;

  const report = await syncSubscriptionPrices("test", stripe, store);
  const club = report.plans.find((p) => p.code === "CLUB")!;
  assertEquals([club.price, club.plan_row, club.unit_amount], ["replaced", "updated", 37900]);
  assert(club.price_id !== oldId);
  assertEquals(stripe.prices.find((p) => p.id === oldId)!.active, false);
  assertEquals(stripe.prices.find((p) => p.id === oldId)!.lookup_key, null);
  assertEquals(stripe.prices.find((p) => p.id === club.price_id)!.lookup_key, "CLUB");
  assertEquals(store.rows.find((r) => r.code === "CLUB")!.stripe_price_id, club.price_id);
  assertEquals(stripe.prices.filter((p) => p.active).length, 4);
});

Deno.test("an existing product with a stale name is updated, not duplicated", async () => {
  const stripe = new FakeStripe();
  stripe.products.set("motion_sub_coach", { id: "motion_sub_coach", name: "Old", active: false, metadata: {} });
  const report = await syncSubscriptionPrices("test", stripe, memoryStore(SPEC_PLANS));
  assertEquals(report.plans.find((p) => p.code === "COACH")!.product, "updated");
  assertEquals(stripe.products.get("motion_sub_coach")!.active, true);
  assertEquals(stripe.products.get("motion_sub_coach")!.name, "Motion România · Antrenor");
});

Deno.test("inactive plans are skipped and invalid rows stop the run before any Stripe write", async () => {
  const stripe = new FakeStripe();
  const plans = SPEC_PLANS.map((p) => (p.code === "CLUB_PRO" ? { ...p, active: false } : p));
  const report = await syncSubscriptionPrices("test", stripe, memoryStore(plans));
  assertEquals(report.skipped_inactive, ["CLUB_PRO"]);
  assert(!stripe.products.has("motion_sub_club_pro"));

  const fresh = new FakeStripe();
  const broken = SPEC_PLANS.map((p) => (p.code === "CLUB" ? { ...p, price_bani: 349.9 } : p));
  let message = "";
  try {
    await syncSubscriptionPrices("test", fresh, memoryStore(broken));
  } catch (error) {
    message = (error as Error).message;
  }
  assert(message.includes("CLUB"), message);
  assertEquals(fresh.calls, []);
});

Deno.test("key prefixes decide the Stripe mode", () => {
  assertEquals(stripeModeFromKey("sk_test_abc"), "test");
  assertEquals(stripeModeFromKey("rk_test_abc"), "test");
  assertEquals(stripeModeFromKey("sk_live_abc"), "live");
  assertEquals(stripeModeFromKey("rk_live_abc"), "live");
  assertEquals(stripeModeFromKey("pk_test_abc"), null);
  assertEquals(stripeModeFromKey("NOT_CONFIGURED"), null);
  assertEquals(stripeModeFromKey(undefined), null);
});

function handlerWith(key: string | undefined, admin: boolean) {
  const stripe = new FakeStripe();
  const store = memoryStore(SPEC_PLANS);
  const handler = createSyncHandler({
    stripeKey: key,
    modeFromKey: stripeModeFromKey,
    requireAdmin: async () => admin,
    catalog: () => stripe,
    store: () => store,
  });
  return { handler, stripe, store };
}

const post = (body: unknown = {}) =>
  new Request("http://localhost/sync-subscription-prices", { method: "POST", body: JSON.stringify(body) });

Deno.test("only an admin may run the sync", async () => {
  const { handler, stripe } = handlerWith("sk_test_x", false);
  const response = await handler(post());
  assertEquals(response.status, 403);
  assertEquals(stripe.calls, []);
});

Deno.test("GET is refused", async () => {
  const { handler } = handlerWith("sk_test_x", true);
  assertEquals((await handler(new Request("http://localhost/x"))).status, 405);
});

Deno.test("a live key needs confirmLive, and confirmLive with a test key is refused", async () => {
  const live = handlerWith("sk_live_x", true);
  assertEquals((await live.handler(post())).status, 409);
  assertEquals(live.stripe.calls, []);
  const confirmed = await live.handler(post({ confirmLive: true }));
  assertEquals(confirmed.status, 200);
  assertEquals((await confirmed.json()).mode, "live");

  const test = handlerWith("sk_test_x", true);
  assertEquals((await test.handler(post({ confirmLive: true }))).status, 409);
  assertEquals(test.stripe.calls, []);
});

Deno.test("a missing or publishable key is refused before any Stripe call", async () => {
  for (const key of [undefined, "pk_test_x", "NOT_CONFIGURED"]) {
    const { handler, stripe } = handlerWith(key, true);
    assertEquals((await handler(post())).status, 503, String(key));
    assertEquals(stripe.calls, []);
  }
});

Deno.test("an admin run in test mode returns the report", async () => {
  const { handler, store } = handlerWith("sk_test_x", true);
  const response = await handler(post());
  assertEquals(response.status, 200);
  const report = await response.json();
  assertEquals(report.plans.length, 4);
  assert(store.rows.every((row) => row.stripe_price_id?.startsWith("price_fake_")));
});

Deno.test("no Stripe price id is hard-coded in the client app", async () => {
  const offenders: string[] = [];
  const pattern = /price_1[A-Za-z0-9]{12,}/;
  async function walk(dir: string) {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory) await walk(path);
      else if (/\.(ts|tsx|js|mjs|json)$/.test(entry.name) && pattern.test(await Deno.readTextFile(path))) {
        offenders.push(path);
      }
    }
  }
  await walk(new URL("../../../motiontimisoaraApp/src", import.meta.url).pathname);
  assertEquals(offenders, []);
});
