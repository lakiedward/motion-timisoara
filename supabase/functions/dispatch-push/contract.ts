export type PushClaim = { deliveryId: string; leaseId: string };
export type PushData = {
  eventId: string;
  bindingId: string;
  kind: "announcement" | "attendance" | "course" | "camp";
  entityId: string;
  path: string;
  title: string;
  body: string;
  expiresAt: string;
};
export type PushDelivery = {
  token: string;
  data: PushData;
  ttlSeconds: number;
};
export type PushOutcome = {
  outcome: "sent" | "retry" | "invalid_token" | "failed";
  code: string;
  retryAfter?: number;
};
export type Dispatcher = {
  secret: string | undefined;
  authorize: () => Promise<string>;
  claim: () => Promise<PushClaim[]>;
  prepare: (claim: PushClaim) => Promise<unknown>;
  finish: (claim: PushClaim, outcome: PushOutcome) => Promise<void>;
  send: (delivery: PushDelivery, accessToken: string) => Promise<PushOutcome>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATA_KEYS = [
  "bindingId",
  "body",
  "entityId",
  "eventId",
  "expiresAt",
  "kind",
  "path",
  "title",
];

export function parsePushDelivery(
  value: unknown,
  now = Date.now(),
): PushDelivery | null {
  if (value === null || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.token !== "string" || row.token.length < 20 ||
    row.token.length > 4096 || /\s/.test(row.token)
  ) return null;
  if (
    !Number.isInteger(row.ttlSeconds) || (row.ttlSeconds as number) < 1 ||
    (row.ttlSeconds as number) > 3600
  ) return null;
  if (row.data === null || typeof row.data !== "object") return null;
  const data = row.data as Record<string, unknown>;
  if (
    Object.keys(data).sort().join() !== DATA_KEYS.join() ||
    Object.values(data).some((value) => typeof value !== "string")
  ) return null;
  if (
    ![data.eventId, data.bindingId, data.entityId].every((value) =>
      UUID.test(value as string)
    )
  ) return null;
  if (
    !/^\d{13}$/.test(data.expiresAt as string) || Number(data.expiresAt) <= now
  ) return null;
  const paths = {
    announcement: "/account/announcements",
    attendance: "/account/attendance",
    course: `/cursuri/${data.entityId}`,
  };
  if (data.kind === "camp") {
    if (
      data.path !== "/tabere" &&
      !/^\/tabere\/[a-z0-9-]{3,2000}$/.test(data.path as string)
    ) return null;
  } else if (
    !(data.kind as string in paths) ||
    data.path !== paths[data.kind as keyof typeof paths]
  ) return null;
  if (
    (data.title as string).length > 100 || (data.body as string).length > 200
  ) return null;
  if (new TextEncoder().encode(JSON.stringify(data)).length > 3500) return null;
  return {
    token: row.token,
    data: data as PushData,
    ttlSeconds: Math.min(
      row.ttlSeconds as number,
      Math.max(1, Math.floor((Number(data.expiresAt) - now) / 1000)),
    ),
  };
}

async function authorized(
  secret: string | undefined,
  supplied: string | null,
): Promise<boolean> {
  if (!secret || secret.length < 32 || !supplied || supplied.length > 1024) {
    return false;
  }
  const encode = (value: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [expected, received] = await Promise.all([
    encode(secret),
    encode(supplied),
  ]);
  const a = new Uint8Array(expected);
  const b = new Uint8Array(received);
  let mismatch = 0;
  for (let index = 0; index < a.length; index++) {
    mismatch |= a[index] ^ b[index];
  }
  return mismatch === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export function pushDispatcher(dependencies: Dispatcher) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    if (
      !await authorized(
        dependencies.secret,
        request.headers.get("x-push-dispatch-secret"),
      )
    ) return json({ error: "Unauthorized" }, 401);
    try {
      const body = await request.text();
      if (
        body.length > 1024 ||
        (body.trim() && JSON.stringify(JSON.parse(body)) !== "{}")
      ) return json({ error: "Invalid request" }, 400);
    } catch {
      return json({ error: "Invalid request" }, 400);
    }
    try {
      const accessToken = await dependencies.authorize();
      const claims = await dependencies.claim();
      const totals = {
        claimed: claims.length,
        sent: 0,
        retry: 0,
        skipped: 0,
        failed: 0,
      };
      const process = async (claim: PushClaim) => {
        const current = await dependencies.prepare(claim);
        if (current === null) {
          totals.skipped++;
          return;
        }
        const delivery = parsePushDelivery(current);
        let outcome: PushOutcome;
        if (!delivery) outcome = { outcome: "failed", code: "INVALID_PAYLOAD" };
        else {
          try {
            outcome = await dependencies.send(delivery, accessToken);
          } catch {
            outcome = { outcome: "retry", code: "FCM_NETWORK" };
          }
        }
        await dependencies.finish(claim, outcome);
        if (outcome.outcome === "sent") totals.sent++;
        else if (outcome.outcome === "retry") totals.retry++;
        else totals.failed++;
      };
      for (let index = 0; index < claims.length; index += 4) {
        const results = await Promise.allSettled(
          claims.slice(index, index + 4).map(process),
        );
        if (results.some((result) => result.status === "rejected")) {
          return json({ error: "Dispatch incomplete" }, 503);
        }
      }
      return json(totals);
    } catch {
      return json({ error: "Dispatch unavailable" }, 503);
    }
  };
}
