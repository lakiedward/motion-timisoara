import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import { withCors } from "../_shared/cors.ts";
import { getStripe } from "../_shared/stripe.ts";
import { getUser, getUserRole } from "../_shared/supabase.ts";
import { stripeModeFromKey } from "../sync-subscription-prices/sync.ts";
import { createSetupHandler, type WebhookEndpointApi } from "./handler.ts";

function stripeEndpoints(): WebhookEndpointApi {
  const stripe = getStripe();
  return {
    async list() {
      const { data } = await stripe.webhookEndpoints.list({ limit: 100 });
      return data.map((endpoint: Stripe.WebhookEndpoint) => ({ id: endpoint.id, url: endpoint.url }));
    },
    async create({ url, events, description }) {
      const endpoint = await stripe.webhookEndpoints.create({
        url,
        enabled_events: events as never,
        description,
      });
      if (!endpoint.secret) throw new Error("Stripe nu a întors secretul endpointului.");
      return { id: endpoint.id, url: endpoint.url, secret: endpoint.secret };
    },
    async remove(id) {
      await stripe.webhookEndpoints.del(id);
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

const supabaseUrl = Deno.env.get("SUPABASE_URL");

serve(
  withCors(
    createSetupHandler({
      stripeKey: Deno.env.get("STRIPE_SECRET_KEY"),
      modeFromKey: stripeModeFromKey,
      requireAdmin,
      endpoints: stripeEndpoints,
      webhookUrl: supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/stripe-subscription-webhook` : undefined,
    }),
  ),
);
