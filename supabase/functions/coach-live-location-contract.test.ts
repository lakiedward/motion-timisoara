import {
  locationHandler,
  locationResponse,
  parseLocationRequest,
} from "./coach-live-location/contract.ts";

const occurrenceId = "00000000-0000-0000-0000-000000000101";
const sessionId = "00000000-0000-0000-0000-000000000201";
const actorId = "00000000-0000-0000-0000-000000000001";
const requestId = "00000000-0000-0000-0000-000000000301";
const start = { action: "start", occurrenceId, requestId, consent: true };
const update = {
  action: "update",
  occurrenceId,
  sessionId,
  latitude: 0,
  longitude: 0,
  accuracy: 10,
  capturedAt: "2026-09-09T14:00:00.000Z",
};
function assert(value: unknown, label = "Assertion failed"): asserts value {
  if (!value) throw new Error(label);
}
const post = (value: unknown) =>
  new Request("https://local.test/coach-live-location", {
    method: "POST",
    body: JSON.stringify(value),
    headers: { "Content-Type": "application/json" },
  });

Deno.test("all operations use explicit session and consent contracts", () => {
  for (
    const request of [
      start,
      update,
      { action: "status", occurrenceId },
      { action: "read", occurrenceId, sessionId },
      { action: "stop", occurrenceId, sessionId },
      {
        action: "consent",
        occurrenceId,
        sessionId,
        consent: true,
        expectedVersion: 0,
      },
      {
        action: "consent",
        occurrenceId,
        sessionId,
        consent: false,
        expectedVersion: 1,
      },
    ]
  ) {
    assert(parseLocationRequest(request), JSON.stringify(request));
  }
});

Deno.test("caller identities, implicit starts and ambiguous bodies are rejected", () => {
  for (
    const request of [
      null,
      [],
      {},
      { ...start, actorId },
      { ...start, parentId: actorId },
      { ...start, consent: false },
      { ...start, consent: "true" },
      { ...start, consent: undefined },
      { ...start, requestId: undefined },
      { ...start, requestId: "bad" },
      { ...start, sessionId },
      { ...start, occurrenceId: "bad" },
      { action: "read", occurrenceId },
      { action: "status", occurrenceId, sessionId },
      { action: "consent", occurrenceId, sessionId, consent: true },
      {
        action: "consent",
        occurrenceId,
        sessionId,
        consent: true,
        expectedVersion: -1,
      },
      {
        action: "consent",
        occurrenceId,
        sessionId,
        consent: true,
        expectedVersion: 1.5,
      },
      { action: "purge", occurrenceId, sessionId },
      { action: "read", occurrenceId, sessionId, latitude: 1 },
    ]
  ) {
    assert(parseLocationRequest(request) === null);
  }
});

Deno.test("coordinates are finite and bounded and capture time must carry timezone", () => {
  for (
    const patch of [
      { latitude: NaN },
      { latitude: Infinity },
      { latitude: 91 },
      { longitude: -181 },
      { longitude: "0" },
      { accuracy: -1 },
      { accuracy: 10001 },
      { accuracy: undefined },
      { capturedAt: "now" },
      { capturedAt: "infinity" },
      { capturedAt: "2026-09-09T14:00:00" },
      { capturedAt: null },
      { sessionId: null },
    ]
  ) {
    assert(parseLocationRequest({ ...update, ...patch }) === null);
  }
});

Deno.test("verified JWT actor is the exclusive identity passed to the SQL operation", async () => {
  let calls = 0;
  const handler = locationHandler({
    getActor: async () => ({ id: actorId }),
    transact: async (id, request) => {
      calls++;
      assert(
        id === actorId && request.action === "start" &&
          request.occurrenceId === occurrenceId,
      );
      return { success: true, sessionId };
    },
  });
  assert(
    (await handler(post({ ...start, actorId: sessionId }))).status === 400,
  );
  assert(calls === 0);
  const response = await handler(post(start));
  assert(response.status === 200 && Number(calls) === 1);
  assert(response.headers.get("Cache-Control")?.includes("no-store"));
});

Deno.test("unauthorized requests and malformed JSON never reach the transaction", async () => {
  let calls = 0;
  const transact = async () => {
    calls++;
    return { success: true as const, sessionId };
  };
  const unauthorized = locationHandler({
    getActor: async () => {
      throw new Response(null, { status: 401 });
    },
    transact,
  });
  assert((await unauthorized(post(start))).status === 401 && calls === 0);
  const authorized = locationHandler({
    getActor: async () => ({ id: actorId }),
    transact,
  });
  const malformed = new Request("https://local.test", {
    method: "POST",
    body: "{",
  });
  assert((await authorized(malformed)).status === 400);
  assert(
    (await authorized(post({ ...start, padding: "x".repeat(5000) }))).status ===
      400,
  );
  assert((await authorized(new Request("https://local.test"))).status === 405);
  assert(calls === 0);
});

Deno.test("access and lifecycle rejections preserve safe codes without sensitive error details", async () => {
  for (
    const [code, status] of [
      ["FORBIDDEN", 403],
      ["NOT_ELIGIBLE", 403],
      ["CONSENT_REQUIRED", 403],
      ["SESSION_EXPIRED", 409],
      ["SESSION_NOT_FOUND", 409],
      ["STALE_LOCATION", 409],
      ["REQUEST_CONFLICT", 409],
      ["INVALID_REQUEST", 400],
      ["UNAUTHORIZED", 401],
    ] as const
  ) {
    const response = locationResponse({ success: false, code });
    assert(
      response.status === status &&
        response.headers.get("Cache-Control")?.includes("no-store"),
    );
    assert((await response.json()).code === code);
  }
  const handler = locationHandler({
    getActor: async () => ({ id: actorId }),
    transact: async () => {
      throw new Error("sensitive coordinate SQL detail");
    },
  });
  const response = await handler(post(update));
  assert(
    response.status === 500 && !(await response.text()).includes("sensitive"),
  );
  assert(
    !(await locationResponse({ success: false, code: "sensitive" }).text())
      .includes("sensitive"),
  );
});
