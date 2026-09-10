const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LocationTarget =
  | { occurrenceId: string; campId?: never; coachId?: never }
  | { campId: string; coachId: string; occurrenceId?: never };
type SessionRequest = LocationTarget & { sessionId: string };
export type LocationRequest =
  | { action: "list" }
  | { action: "participants"; campId: string }
  | { action: "arrive" | "depart"; campId: string; enrollmentId: string }
  | (LocationTarget & { action: "status" })
  | (LocationTarget & { action: "start"; requestId: string; consent: true })
  | (SessionRequest & { action: "read" | "stop" })
  | (SessionRequest & {
    action: "consent";
    consent: boolean;
    expectedVersion: number;
  })
  | (SessionRequest & {
    action: "update";
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: string;
  });

export type LocationResult =
  | { success: true; sessions: unknown[] }
  | {
    success: true;
    participants: unknown[];
    startsAt: string;
    endsAt: string;
    canShare: boolean;
  }
  | { success: true }
  | {
    success: true;
    sessionId: string;
    expiresAt?: string;
    location?: unknown;
    consentVersion?: number;
    consentGranted?: boolean;
  }
  | { success: false; code: string };

export function parseLocationRequest(value: unknown): LocationRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const only = (...keys: string[]) =>
    Object.keys(input).every((key) => keys.includes(key));
  if (input.action === "list") {
    return only("action") ? { action: "list" } : null;
  }
  if (["participants", "arrive", "depart"].includes(String(input.action))) {
    if (typeof input.campId !== "string" || !uuid.test(input.campId)) {
      return null;
    }
    if (input.action === "participants") {
      return only("action", "campId")
        ? { action: "participants", campId: input.campId }
        : null;
    }
    return (input.action === "arrive" || input.action === "depart") &&
        typeof input.enrollmentId === "string" &&
        uuid.test(input.enrollmentId) &&
        only("action", "campId", "enrollmentId")
      ? {
        action: input.action,
        campId: input.campId,
        enrollmentId: input.enrollmentId,
      }
      : null;
  }
  let target: LocationTarget;
  let targetKeys: string[];
  if (Object.hasOwn(input, "campId")) {
    if (
      typeof input.campId !== "string" || !uuid.test(input.campId) ||
      typeof input.coachId !== "string" || !uuid.test(input.coachId)
    ) return null;
    target = { campId: input.campId, coachId: input.coachId };
    targetKeys = ["campId", "coachId"];
  } else {
    if (
      typeof input.occurrenceId !== "string" || !uuid.test(input.occurrenceId)
    ) return null;
    target = { occurrenceId: input.occurrenceId };
    targetKeys = ["occurrenceId"];
  }
  if (input.action === "status") {
    return only("action", ...targetKeys)
      ? { action: "status", ...target }
      : null;
  }
  if (input.action === "start") {
    return input.consent === true && typeof input.requestId === "string" &&
        uuid.test(input.requestId) &&
        only("action", ...targetKeys, "requestId", "consent")
      ? {
        action: "start",
        ...target,
        requestId: input.requestId,
        consent: true,
      }
      : null;
  }
  if (typeof input.sessionId !== "string" || !uuid.test(input.sessionId)) {
    return null;
  }
  const base = { ...target, sessionId: input.sessionId };
  if (input.action === "read" || input.action === "stop") {
    return only("action", ...targetKeys, "sessionId")
      ? { ...base, action: input.action }
      : null;
  }
  if (input.action === "consent") {
    return typeof input.consent === "boolean" &&
        typeof input.expectedVersion === "number" &&
        Number.isInteger(input.expectedVersion) &&
        input.expectedVersion >= 0 && input.expectedVersion <= 2147483646 &&
        only(
          "action",
          ...targetKeys,
          "sessionId",
          "consent",
          "expectedVersion",
        )
      ? {
        ...base,
        action: "consent",
        consent: input.consent,
        expectedVersion: input.expectedVersion,
      }
      : null;
  }
  const numberInRange = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  if (
    input.action === "update" &&
    only(
      "action",
      ...targetKeys,
      "sessionId",
      "latitude",
      "longitude",
      "accuracy",
      "capturedAt",
    ) &&
    numberInRange(input.latitude, -90, 90) &&
    numberInRange(input.longitude, -180, 180) &&
    numberInRange(input.accuracy, 0, 10000) &&
    typeof input.capturedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/
      .test(input.capturedAt) &&
    Number.isFinite(Date.parse(input.capturedAt))
  ) {
    return {
      ...base,
      action: "update",
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      capturedAt: input.capturedAt,
    };
  }
  return null;
}

const messages: Record<string, string> = {
  INVALID_REQUEST: "Cererea de locație nu este validă.",
  UNAUTHORIZED: "Sesiunea a expirat. Autentifică-te din nou.",
  FORBIDDEN: "Nu ai acces la această activitate.",
  CAMP_NOT_FOUND: "Tabăra nu este disponibilă.",
  OCCURRENCE_NOT_FOUND: "Ședința nu este disponibilă.",
  SESSION_NOT_FOUND: "Partajarea locației nu este activă.",
  SESSION_EXPIRED: "Partajarea locației s-a încheiat.",
  CONSENT_REQUIRED: "Confirmă acordul pentru partajarea locației.",
  NOT_ELIGIBLE:
    "Locația este disponibilă părinților copiilor înscriși și confirmați prezenți.",
  STALE_LOCATION: "Poziția este prea veche. Trimite o poziție nouă.",
  REQUEST_CONFLICT:
    "Acordul a fost modificat între timp. Reîncarcă starea curentă.",
  SERVER_ERROR: "Locația nu este disponibilă momentan.",
};

export function locationResponse(result: LocationResult): Response {
  const headers = {
    "Cache-Control": "no-store, private",
    "Pragma": "no-cache",
  };
  if (result.success) return Response.json(result, { headers });
  const code = Object.hasOwn(messages, result.code)
    ? result.code
    : "SERVER_ERROR";
  const status = code === "UNAUTHORIZED"
    ? 401
    : ["FORBIDDEN", "CONSENT_REQUIRED", "NOT_ELIGIBLE"].includes(code)
    ? 403
    : code === "INVALID_REQUEST"
    ? 400
    : code === "SERVER_ERROR"
    ? 500
    : 409;
  return Response.json({ success: false, code, message: messages[code] }, {
    status,
    headers,
  });
}

export type LocationDependencies = {
  getActor: (request: Request) => Promise<{ id: string }>;
  transact: (
    actorId: string,
    payload: LocationRequest,
  ) => Promise<LocationResult>;
};

export function locationHandler(dependencies: LocationDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return new Response(null, {
        status: 405,
        headers: { "Allow": "POST", "Cache-Control": "no-store, private" },
      });
    }
    try {
      const actor = await dependencies.getActor(request);
      let value: unknown;
      try {
        const body = await request.text();
        if (body.length > 4096) {
          return locationResponse({ success: false, code: "INVALID_REQUEST" });
        }
        value = JSON.parse(body);
      } catch {
        return locationResponse({ success: false, code: "INVALID_REQUEST" });
      }
      const payload = parseLocationRequest(value);
      if (!payload) {
        return locationResponse({ success: false, code: "INVALID_REQUEST" });
      }
      return locationResponse(await dependencies.transact(actor.id, payload));
    } catch (error) {
      return locationResponse({
        success: false,
        code: error instanceof Response && error.status === 401
          ? "UNAUTHORIZED"
          : "SERVER_ERROR",
      });
    }
  };
}
