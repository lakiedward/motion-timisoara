export type StripeMode = "test" | "live";

export type SubscriptionPlan = {
  code: string;
  subscriber_type: "COACH" | "CLUB";
  name: string;
  price_bani: number;
  active: boolean;
  stripe_price_id: string | null;
};

export type CatalogProduct = {
  id: string;
  name: string;
  active: boolean;
  metadata: Record<string, string>;
};

export type CatalogPrice = {
  id: string;
  product: string;
  currency: string;
  unit_amount: number | null;
  interval: string | null;
  interval_count: number | null;
  tax_behavior: string | null;
  active: boolean;
};

export type NewPrice = {
  product: string;
  currency: "ron";
  unit_amount: number;
  interval: "month";
  lookup_key: string;
  transfer_lookup_key: boolean;
  tax_behavior: "inclusive";
  metadata: Record<string, string>;
};

export type StripeCatalog = {
  retrieveProduct(id: string): Promise<CatalogProduct | null>;
  createProduct(product: CatalogProduct): Promise<CatalogProduct>;
  updateProduct(id: string, changes: Partial<Omit<CatalogProduct, "id">>): Promise<CatalogProduct>;
  findPriceByLookupKey(lookupKey: string): Promise<CatalogPrice | null>;
  createPrice(price: NewPrice): Promise<CatalogPrice>;
  archivePrice(id: string): Promise<void>;
};

export type PlanStore = {
  listPlans(): Promise<SubscriptionPlan[]>;
  setStripePriceId(code: string, priceId: string): Promise<void>;
};

export type PlanSyncResult = {
  code: string;
  product_id: string;
  price_id: string;
  unit_amount: number;
  product: "created" | "updated" | "unchanged";
  price: "created" | "replaced" | "unchanged";
  plan_row: "updated" | "unchanged";
};

export type SyncReport = {
  mode: StripeMode;
  plans: PlanSyncResult[];
  skipped_inactive: string[];
};

const PLAN_CODE = /^[A-Z][A-Z0-9_]{1,39}$/;

export function stripeModeFromKey(key: string | undefined | null): StripeMode | null {
  if (!key) return null;
  if (/^(sk|rk)_live_/.test(key)) return "live";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  return null;
}

export function productIdFor(code: string): string {
  return `motion_sub_${code.toLowerCase()}`;
}

export function productNameFor(plan: SubscriptionPlan): string {
  return `Motion România · ${plan.name}`;
}

export function productMetadataFor(plan: SubscriptionPlan): Record<string, string> {
  return { plan_code: plan.code, subscriber_type: plan.subscriber_type };
}

export function priceMatchesPlan(price: CatalogPrice, plan: SubscriptionPlan): boolean {
  return (
    price.active &&
    price.product === productIdFor(plan.code) &&
    price.currency === "ron" &&
    price.unit_amount === plan.price_bani &&
    price.interval === "month" &&
    price.interval_count === 1 &&
    price.tax_behavior === "inclusive"
  );
}

export function validatePlan(plan: SubscriptionPlan): string | null {
  if (!PLAN_CODE.test(plan.code)) return `Cod de plan invalid: ${plan.code}`;
  if (plan.subscriber_type !== "COACH" && plan.subscriber_type !== "CLUB") {
    return `Tip de abonat invalid pentru ${plan.code}`;
  }
  if (!Number.isInteger(plan.price_bani) || plan.price_bani < 100) {
    return `Preț invalid pentru ${plan.code}: ${plan.price_bani}`;
  }
  if (!plan.name.trim()) return `Planul ${plan.code} nu are nume`;
  return null;
}

async function syncProduct(
  catalog: StripeCatalog,
  plan: SubscriptionPlan,
): Promise<PlanSyncResult["product"]> {
  const id = productIdFor(plan.code);
  const wanted = {
    name: productNameFor(plan),
    active: true,
    metadata: productMetadataFor(plan),
  };
  const existing = await catalog.retrieveProduct(id);
  if (!existing) {
    await catalog.createProduct({ id, ...wanted });
    return "created";
  }
  const metadataMatches = Object.entries(wanted.metadata).every(
    ([key, value]) => existing.metadata[key] === value,
  );
  if (existing.name === wanted.name && existing.active && metadataMatches) return "unchanged";
  await catalog.updateProduct(id, wanted);
  return "updated";
}

async function syncPrice(
  catalog: StripeCatalog,
  plan: SubscriptionPlan,
): Promise<{ price: CatalogPrice; action: PlanSyncResult["price"] }> {
  const existing = await catalog.findPriceByLookupKey(plan.code);
  if (existing && priceMatchesPlan(existing, plan)) return { price: existing, action: "unchanged" };
  const created = await catalog.createPrice({
    product: productIdFor(plan.code),
    currency: "ron",
    unit_amount: plan.price_bani,
    interval: "month",
    lookup_key: plan.code,
    transfer_lookup_key: existing !== null,
    tax_behavior: "inclusive",
    metadata: productMetadataFor(plan),
  });
  if (existing?.active) await catalog.archivePrice(existing.id);
  return { price: created, action: existing ? "replaced" : "created" };
}

export async function syncSubscriptionPrices(
  mode: StripeMode,
  catalog: StripeCatalog,
  store: PlanStore,
): Promise<SyncReport> {
  const plans = await store.listPlans();
  const invalid = plans.map(validatePlan).filter((problem): problem is string => problem !== null);
  if (invalid.length) throw new Error(invalid.join("; "));
  const active = plans.filter((plan) => plan.active).sort((a, b) => a.price_bani - b.price_bani);
  if (!active.length) throw new Error("Tabelul subscription_plans nu are planuri active");

  const results: PlanSyncResult[] = [];
  for (const plan of active) {
    const product = await syncProduct(catalog, plan);
    const { price, action } = await syncPrice(catalog, plan);
    let planRow: PlanSyncResult["plan_row"] = "unchanged";
    if (plan.stripe_price_id !== price.id) {
      await store.setStripePriceId(plan.code, price.id);
      planRow = "updated";
    }
    results.push({
      code: plan.code,
      product_id: productIdFor(plan.code),
      price_id: price.id,
      unit_amount: plan.price_bani,
      product,
      price: action,
      plan_row: planRow,
    });
  }
  return {
    mode,
    plans: results,
    skipped_inactive: plans.filter((plan) => !plan.active).map((plan) => plan.code),
  };
}

export type PlannedWrite = {
  target: "stripe" | "database";
  operation: string;
  id: string;
  detail: string;
};

export type DryRunReport = SyncReport & { dry_run: true; planned_writes: PlannedWrite[] };

export function pendingPriceId(lookupKey: string): string {
  return `(preț nou ${lookupKey})`;
}

export function planningCatalog(catalog: StripeCatalog, planned: PlannedWrite[]): StripeCatalog {
  return {
    retrieveProduct: (id) => catalog.retrieveProduct(id),
    findPriceByLookupKey: (lookupKey) => catalog.findPriceByLookupKey(lookupKey),
    createProduct(product) {
      planned.push({ target: "stripe", operation: "products.create", id: product.id, detail: product.name });
      return Promise.resolve({ ...product });
    },
    updateProduct(id, changes) {
      planned.push({
        target: "stripe",
        operation: "products.update",
        id,
        detail: `name=${changes.name ?? "-"}, active=${changes.active ?? "-"}`,
      });
      return Promise.resolve({ id, name: changes.name ?? "", active: changes.active ?? true, metadata: changes.metadata ?? {} });
    },
    createPrice(price) {
      const id = pendingPriceId(price.lookup_key);
      planned.push({
        target: "stripe",
        operation: "prices.create",
        id,
        detail: `${price.unit_amount / 100} ${price.currency}/lună, lookup_key=${price.lookup_key}` +
          (price.transfer_lookup_key ? " (mută lookup_key de pe prețul vechi)" : ""),
      });
      return Promise.resolve({
        id,
        product: price.product,
        currency: price.currency,
        unit_amount: price.unit_amount,
        interval: price.interval,
        interval_count: 1,
        tax_behavior: price.tax_behavior,
        active: true,
      });
    },
    archivePrice(id) {
      planned.push({ target: "stripe", operation: "prices.update", id, detail: "active=false (arhivat)" });
      return Promise.resolve();
    },
  };
}

export function planningStore(store: PlanStore, planned: PlannedWrite[]): PlanStore {
  return {
    listPlans: () => store.listPlans(),
    setStripePriceId(code, priceId) {
      planned.push({
        target: "database",
        operation: "subscription_plans.stripe_price_id",
        id: code,
        detail: priceId,
      });
      return Promise.resolve();
    },
  };
}

export async function planSubscriptionPrices(
  mode: StripeMode,
  catalog: StripeCatalog,
  store: PlanStore,
): Promise<DryRunReport> {
  const planned: PlannedWrite[] = [];
  const report = await syncSubscriptionPrices(mode, planningCatalog(catalog, planned), planningStore(store, planned));
  return { ...report, dry_run: true, planned_writes: planned };
}
