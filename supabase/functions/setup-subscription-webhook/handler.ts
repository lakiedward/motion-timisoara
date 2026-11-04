import type { StripeMode } from "../sync-subscription-prices/sync.ts";
import { HANDLED_EVENTS } from "../stripe-subscription-webhook/handler.ts";

export interface WebhookEndpoint {
  id: string;
  url: string;
  status?: string;
  enabled_events?: string[];
  description?: string | null;
}

export interface CreatedEndpoint extends WebhookEndpoint {
  secret: string;
}

export interface WebhookEndpointApi {
  list(): Promise<WebhookEndpoint[]>;
  create(input: { url: string; events: string[]; description: string; connect: boolean }): Promise<CreatedEndpoint>;
  remove(id: string): Promise<void>;
}

export type SetupHandlerDeps = {
  stripeKey: string | undefined;
  modeFromKey: (key: string | undefined) => StripeMode | null;
  requireAdmin: (req: Request) => Promise<boolean>;
  endpoints: () => WebhookEndpointApi;
  functionsBaseUrl: string | undefined;
};

export type WebhookKind = "subscriptions" | "payments" | "connect";

export type WebhookTarget = {
  functionName: string;
  events: string[];
  connect: boolean;
  description: string;
  secretName: string;
};

export const SUBSCRIPTION_EVENTS = [...HANDLED_EVENTS];

export const WEBHOOK_TARGETS: Record<WebhookKind, WebhookTarget> = {
  subscriptions: {
    functionName: "stripe-subscription-webhook",
    events: SUBSCRIPTION_EVENTS,
    connect: false,
    description: "Motion România: abonamente antrenori și cluburi",
    secretName: "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET",
  },
  payments: {
    functionName: "stripe-webhook",
    events: ["payment_intent.succeeded", "payment_intent.payment_failed"],
    connect: false,
    description: "Motion România: plăți cu cardul pentru înscrieri",
    secretName: "STRIPE_WEBHOOK_SECRET",
  },
  connect: {
    functionName: "stripe-connect-webhook",
    events: ["account.updated"],
    connect: true,
    description: "Motion România: starea conturilor Connect ale antrenorilor și cluburilor",
    secretName: "STRIPE_CONNECT_WEBHOOK_SECRET",
  },
};

const ENDPOINT_ID = /^we_[A-Za-z0-9]+$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isKind(value: unknown): value is WebhookKind {
  return typeof value === "string" && Object.hasOwn(WEBHOOK_TARGETS, value);
}

export function webhookUrlFor(functionsBaseUrl: string, kind: WebhookKind): string {
  return `${functionsBaseUrl.replace(/\/$/, "")}/${WEBHOOK_TARGETS[kind].functionName}`;
}

function publicEndpoint(endpoint: WebhookEndpoint) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    status: endpoint.status ?? null,
    enabled_events: endpoint.enabled_events ?? [],
    description: endpoint.description ?? null,
  };
}

async function listEndpoints(api: WebhookEndpointApi, mode: StripeMode, base: string): Promise<Response> {
  const known = new Map<string, WebhookKind>(
    (Object.keys(WEBHOOK_TARGETS) as WebhookKind[]).map((kind): [string, WebhookKind] => [webhookUrlFor(base, kind), kind]),
  );
  const endpoints = (await api.list()).map((endpoint) => ({
    ...publicEndpoint(endpoint),
    kind: known.get(endpoint.url) ?? null,
  }));
  return json({ mode, endpoints });
}

async function removeEndpoints(api: WebhookEndpointApi, mode: StripeMode, ids: unknown): Promise<Response> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 10 || !ids.every((id) => ENDPOINT_ID.test(String(id)))) {
    return json({ error: "Trimite remove: [\"we_…\"] cu cel mult 10 endpointuri." }, 400);
  }
  const existing = new Set((await api.list()).map((endpoint) => endpoint.id));
  const missing = ids.filter((id) => !existing.has(id));
  if (missing.length) return json({ error: "Endpointuri inexistente în Stripe.", mode, missing }, 404);
  for (const id of ids) await api.remove(id);
  return json({ mode, removed: ids });
}

async function createEndpoint(
  api: WebhookEndpointApi,
  mode: StripeMode,
  base: string,
  kind: WebhookKind,
  replace: boolean,
): Promise<Response> {
  const target = WEBHOOK_TARGETS[kind];
  const url = webhookUrlFor(base, kind);
  const existing = (await api.list()).filter((endpoint) => endpoint.url === url);
  if (existing.length > 0 && !replace) {
    return json({
      error: "Endpointul există deja în Stripe. Trimite replace: true ca să-l înlocuiești cu unul nou.",
      mode,
      kind,
      endpoint_ids: existing.map((endpoint) => endpoint.id),
    }, 409);
  }
  for (const endpoint of existing) await api.remove(endpoint.id);
  const created = await api.create({
    url,
    events: target.events,
    description: target.description,
    connect: target.connect,
  });
  return json({
    mode,
    kind,
    endpoint_id: created.id,
    url: created.url,
    events: target.events,
    connect: target.connect,
    secret_name: target.secretName,
    replaced: existing.map((endpoint) => endpoint.id),
    secret: created.secret,
  });
}

export function createSetupHandler(deps: SetupHandlerDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!(await deps.requireAdmin(req))) {
      return json({ error: "Doar un administrator poate configura webhook-urile Stripe." }, 403);
    }
    const mode = deps.modeFromKey(deps.stripeKey);
    if (!mode) return json({ error: "Cheia Stripe lipsește sau nu este o cheie secretă." }, 503);
    if (!deps.functionsBaseUrl) return json({ error: "SUPABASE_URL lipsește." }, 503);
    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "create";
    if (!["create", "list", "remove"].includes(action)) return json({ error: `Acțiune necunoscută: ${action}` }, 400);
    const kind = body?.kind ?? "subscriptions";
    if (action === "create" && !isKind(kind)) return json({ error: `Tip de webhook necunoscut: ${kind}` }, 400);
    if (action !== "list" && mode === "live" && body?.confirmLive !== true) {
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
      if (action === "list") return await listEndpoints(api, mode, deps.functionsBaseUrl);
      if (action === "remove") return await removeEndpoints(api, mode, body?.remove);
      return await createEndpoint(api, mode, deps.functionsBaseUrl, kind, body?.replace === true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message, mode }, 500);
    }
  };
}
