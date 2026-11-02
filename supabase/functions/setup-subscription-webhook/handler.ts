import type { StripeMode } from "../sync-subscription-prices/sync.ts";
import { HANDLED_EVENTS } from "../stripe-subscription-webhook/handler.ts";

export interface WebhookEndpoint {
  id: string;
  url: string;
}

export interface CreatedEndpoint extends WebhookEndpoint {
  secret: string;
}

export interface WebhookEndpointApi {
  list(): Promise<WebhookEndpoint[]>;
  create(input: { url: string; events: string[]; description: string }): Promise<CreatedEndpoint>;
  remove(id: string): Promise<void>;
}

export type SetupHandlerDeps = {
  stripeKey: string | undefined;
  modeFromKey: (key: string | undefined) => StripeMode | null;
  requireAdmin: (req: Request) => Promise<boolean>;
  endpoints: () => WebhookEndpointApi;
  webhookUrl: string | undefined;
};

export const SUBSCRIPTION_EVENTS = [...HANDLED_EVENTS];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function createSetupHandler(deps: SetupHandlerDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!(await deps.requireAdmin(req))) {
      return json({ error: "Doar un administrator poate configura webhook-ul abonamentelor." }, 403);
    }
    const mode = deps.modeFromKey(deps.stripeKey);
    if (!mode) return json({ error: "Cheia Stripe lipsește sau nu este o cheie secretă." }, 503);
    if (!deps.webhookUrl) return json({ error: "SUPABASE_URL lipsește." }, 503);
    const body = await req.json().catch(() => ({}));
    if (mode === "live" && body?.confirmLive !== true) {
      return json(
        { error: "Cheia Stripe este LIVE. Trimite confirmLive: true doar la lansare, după aprobarea proprietarului." },
        409,
      );
    }
    if (mode === "test" && body?.confirmLive === true) {
      return json({ error: "Ai cerut LIVE, dar cheia Stripe este de TEST." }, 409);
    }
    try {
      const api = deps.endpoints();
      const existing = (await api.list()).filter((endpoint) => endpoint.url === deps.webhookUrl);
      if (existing.length > 0 && body?.replace !== true) {
        return json({
          error: "Endpointul există deja în Stripe. Trimite replace: true ca să-l înlocuiești cu unul nou.",
          mode,
          endpoint_ids: existing.map((endpoint) => endpoint.id),
        }, 409);
      }
      for (const endpoint of existing) await api.remove(endpoint.id);
      const created = await api.create({
        url: deps.webhookUrl,
        events: SUBSCRIPTION_EVENTS,
        description: "Motion România: abonamente antrenori și cluburi",
      });
      return json({
        mode,
        endpoint_id: created.id,
        url: created.url,
        events: SUBSCRIPTION_EVENTS,
        replaced: existing.map((endpoint) => endpoint.id),
        secret: created.secret,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message, mode }, 500);
    }
  };
}
