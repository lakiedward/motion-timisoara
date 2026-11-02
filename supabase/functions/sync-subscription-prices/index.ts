import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import { withCors } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";
import { getUser, getUserRole, supabaseAdmin } from "../_shared/supabase.ts";
import { createSyncHandler } from "./handler.ts";
import {
  type CatalogPrice,
  type CatalogProduct,
  type PlanStore,
  type StripeCatalog,
  stripeModeFromKey,
  type SubscriptionPlan,
} from "./sync.ts";

function toProduct(product: Stripe.Product): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    active: product.active,
    metadata: { ...product.metadata },
  };
}

function toPrice(price: Stripe.Price): CatalogPrice {
  return {
    id: price.id,
    product: typeof price.product === "string" ? price.product : price.product.id,
    currency: price.currency,
    unit_amount: price.unit_amount,
    interval: price.recurring?.interval ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    tax_behavior: price.tax_behavior ?? null,
    active: price.active,
  };
}

function stripeCatalog(): StripeCatalog {
  const stripe = getStripe();
  return {
    async retrieveProduct(id) {
      try {
        return toProduct(await stripe.products.retrieve(id));
      } catch (error) {
        if ((error as { code?: string }).code === "resource_missing") return null;
        throw error;
      }
    },
    async createProduct(product) {
      return toProduct(await stripe.products.create(product));
    },
    async updateProduct(id, changes) {
      return toProduct(await stripe.products.update(id, changes));
    },
    async findPriceByLookupKey(lookupKey) {
      const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
      return data[0] ? toPrice(data[0]) : null;
    },
    async createPrice(price) {
      return toPrice(
        await stripe.prices.create({
          product: price.product,
          currency: price.currency,
          unit_amount: price.unit_amount,
          recurring: { interval: price.interval, interval_count: 1 },
          lookup_key: price.lookup_key,
          transfer_lookup_key: price.transfer_lookup_key,
          tax_behavior: price.tax_behavior,
          metadata: price.metadata,
        }),
      );
    },
    async archivePrice(id) {
      await stripe.prices.update(id, { active: false });
    },
  };
}

function planStore(): PlanStore {
  return {
    async listPlans() {
      const { data, error } = await supabaseAdmin
        .from("subscription_plans")
        .select("code, subscriber_type, name, price_bani, active, stripe_price_id");
      if (error) throw new Error(`Nu pot citi subscription_plans: ${error.message}`);
      return (data ?? []) as SubscriptionPlan[];
    },
    async setStripePriceId(code, priceId) {
      const { error } = await supabaseAdmin
        .from("subscription_plans")
        .update({ stripe_price_id: priceId })
        .eq("code", code);
      if (error) throw new Error(`Nu pot salva prețul pentru ${code}: ${error.message}`);
    },
  };
}

async function requireAdmin(req: Request): Promise<boolean> {
  try {
    const user = await getUser(req);
    return (await getUserRole(user.id)) === "ADMIN";
  } catch {
    return false;
  }
}

serve(
  withCors(
    createSyncHandler({
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY"),
      modeFromKey: stripeModeFromKey,
      requireAdmin,
      catalog: stripeCatalog,
      store: planStore,
    }),
  ),
);
