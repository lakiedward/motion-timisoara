const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const token = /^[0-9a-f]{32}$/;

type AttendanceBase = { requestId: string; occurrenceId: string };
export type AttendanceRequest =
  & AttendanceBase
  & (
    | { childId: string; status: "PRESENT" | "ABSENT" | null }
    | { qrToken: string; status: "PRESENT" }
    | { childIds: string[]; status: "PRESENT"; onlyUnmarked: true }
  );

export type AttendanceResult =
  | { success: true; outcome: "recorded" | "duplicate"; childName?: string }
  | { success: false; code: string; message?: string };

export function parseAttendanceRequest(
  value: unknown,
): AttendanceRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.requestId !== "string" || !uuid.test(input.requestId) ||
    typeof input.occurrenceId !== "string" || !uuid.test(input.occurrenceId)
  ) return null;
  const base = { requestId: input.requestId, occurrenceId: input.occurrenceId };
  const onlyKeys = (keys: string[]) =>
    Object.keys(input).every((key) => keys.includes(key));
  if (
    typeof input.qrToken === "string" && token.test(input.qrToken) &&
    input.status === "PRESENT" &&
    onlyKeys(["requestId", "occurrenceId", "qrToken", "status"])
  ) {
    return { ...base, qrToken: input.qrToken, status: "PRESENT" };
  }
  if (
    Array.isArray(input.childIds) && input.childIds.length > 0 &&
    input.childIds.length <= 200 &&
    input.childIds.every((id) => typeof id === "string" && uuid.test(id)) &&
    input.onlyUnmarked === true && input.status === "PRESENT" &&
    onlyKeys([
      "requestId",
      "occurrenceId",
      "childIds",
      "status",
      "onlyUnmarked",
    ])
  ) {
    return {
      ...base,
      childIds: [...new Set(input.childIds)].sort(),
      status: "PRESENT",
      onlyUnmarked: true,
    };
  }
  if (
    typeof input.childId === "string" && uuid.test(input.childId) &&
    (input.status === "PRESENT" || input.status === "ABSENT" ||
      input.status === null) &&
    onlyKeys(["requestId", "occurrenceId", "childId", "status"])
  ) {
    return { ...base, childId: input.childId, status: input.status };
  }
  return null;
}

const rejectionMessages: Record<string, string> = {
  INVALID_REQUEST: "Cererea de prezență nu este validă.",
  FORBIDDEN: "Nu ai acces la această ședință.",
  REQUEST_CONFLICT:
    "Această cerere a fost deja folosită pentru altă modificare.",
  OCCURRENCE_NOT_FOUND: "Ședința nu mai este disponibilă.",
  CHILD_NOT_FOUND: "Copilul nu mai este disponibil.",
  INVALID_QR: "Codul QR nu este valid sau a fost regenerat.",
  MANUAL_OVERRIDE:
    "Prezența a fost corectată manual. Verifică starea în catalog.",
  NOT_ENROLLED: "Copilul nu are o înscriere activă la acest curs.",
  AMBIGUOUS_ENROLLMENT:
    "Copilul are mai multe înscrieri active. Contactează administratorul.",
  NO_REMAINING_SESSIONS: "Copilul nu mai are ședințe disponibile.",
  INVALID_BALANCE: "Soldul ședințelor trebuie verificat de administrator.",
  UNAUTHORIZED: "Sesiunea a expirat. Autentifică-te din nou.",
  SERVER_ERROR: "Prezența nu a putut fi sincronizată. Vom reîncerca.",
};

export function attendanceResponse(result: AttendanceResult): Response {
  if (result.success) return Response.json(result);
  const code = Object.hasOwn(rejectionMessages, result.code)
    ? result.code
    : "SERVER_ERROR";
  const status = code === "UNAUTHORIZED"
    ? 401
    : code === "FORBIDDEN"
    ? 403
    : code === "SERVER_ERROR"
    ? 500
    : code === "INVALID_REQUEST" || code === "INVALID_QR"
    ? 400
    : 409;
  return Response.json({
    success: false,
    code,
    message: rejectionMessages[code],
  }, { status });
}

export type AttendanceDependencies = {
  getActor: (request: Request) => Promise<{ id: string }>;
  record: (
    actorId: string,
    payload: AttendanceRequest,
  ) => Promise<AttendanceResult>;
};

export function attendanceHandler(dependencies: AttendanceDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({
        success: false,
        code: "INVALID_REQUEST",
        message: "Metodă neacceptată.",
      }, { status: 405 });
    }
    try {
      const actor = await dependencies.getActor(request);
      let value: unknown;
      try {
        value = await request.json();
      } catch {
        return attendanceResponse({ success: false, code: "INVALID_REQUEST" });
      }
      const payload = parseAttendanceRequest(value);
      if (!payload) {
        return attendanceResponse({ success: false, code: "INVALID_REQUEST" });
      }
      return attendanceResponse(await dependencies.record(actor.id, payload));
    } catch (error) {
      return attendanceResponse({
        success: false,
        code: error instanceof Response && error.status === 401
          ? "UNAUTHORIZED"
          : "SERVER_ERROR",
      });
    }
  };
}
