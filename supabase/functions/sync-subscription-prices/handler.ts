import { type PlanStore, type StripeCatalog, type StripeMode, syncSubscriptionPrices } from "./sync.ts";

export type SyncHandlerDeps = {
  stripeKey: string | undefined;
  modeFromKey: (key: string | undefined) => StripeMode | null;
  requireAdmin: (req: Request) => Promise<boolean>;
  catalog: () => StripeCatalog;
  store: () => PlanStore;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function createSyncHandler(deps: SyncHandlerDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!(await deps.requireAdmin(req))) {
      return json({ error: "Doar un administrator poate sincroniza prețurile." }, 403);
    }
    const mode = deps.modeFromKey(deps.stripeKey);
    if (!mode) return json({ error: "Cheia Stripe lipsește sau nu este o cheie secretă." }, 503);
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
      return json(await syncSubscriptionPrices(mode, deps.catalog(), deps.store()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ error: message, mode }, 500);
    }
  };
}
