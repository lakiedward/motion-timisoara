import { type ReverseAddress, ReverseProviderError } from "./provider.ts";

type Dependencies = {
  getCaller: (
    req: Request,
  ) => Promise<{ role: string; enabled: boolean } | null>;
  claim: (
    key: string,
  ) => Promise<{ cached?: ReverseAddress; token?: string | null }>;
  lookup: (lat: number, lng: number) => Promise<ReverseAddress | null>;
  finish: (
    token: string,
    key: string,
    result: ReverseAddress | null,
  ) => Promise<void>;
  enabled: boolean;
};

export function createLocationReverseHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    const caller = await deps.getCaller(req);
    if (!caller) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!caller.enabled || !["CLUB", "COACH", "ADMIN"].includes(caller.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!deps.enabled) {
      return Response.json({ error: "Lookup unavailable" }, { status: 503 });
    }
    let body: unknown;
    try {
      const input = await req.text();
      if (input.length > 256) throw new Error("Invalid input");
      body = JSON.parse(input);
    } catch {
      return Response.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid coordinates" }, { status: 400 });
    }
    const { lat, lng } = body as Record<string, unknown>;
    if (
      typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) return Response.json({ error: "Invalid coordinates" }, { status: 400 });
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const claim = await deps.claim(key);
    if (claim.cached) return Response.json({ place: claim.cached });
    if (!claim.token) {
      return Response.json({ error: "Lookup busy" }, {
        status: 429,
        headers: { "Retry-After": "2" },
      });
    }
    let result: ReverseAddress | null = null;
    try {
      result = await deps.lookup(lat, lng);
      return Response.json({ place: result });
    } catch (error) {
      return Response.json({
        error: "Lookup unavailable",
        code: error instanceof ReverseProviderError
          ? error.code
          : "UPSTREAM_UNAVAILABLE",
      }, { status: 503 });
    } finally {
      await deps.finish(claim.token, key, result);
    }
  };
}
