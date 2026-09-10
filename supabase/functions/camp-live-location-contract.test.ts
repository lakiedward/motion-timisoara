import {
  locationHandler,
  parseLocationRequest,
} from "./coach-live-location/contract.ts";

const campId = "00000000-0000-0000-0000-000000000101";
const coachId = "00000000-0000-0000-0000-000000000001";
const sessionId = "00000000-0000-0000-0000-000000000201";
const requestId = "00000000-0000-0000-0000-000000000301";
const enrollmentId = "00000000-0000-0000-0000-000000000401";
const target = { campId, coachId };
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}

Deno.test("camp targets preserve explicit consent and session boundaries", () => {
  const bodies = [
    { action: "status", ...target },
    { action: "start", ...target, consent: true, requestId },
    { action: "read", ...target, sessionId },
    { action: "stop", ...target, sessionId },
    {
      action: "consent",
      ...target,
      sessionId,
      consent: false,
      expectedVersion: 2,
    },
    {
      action: "update",
      ...target,
      sessionId,
      latitude: 0,
      longitude: 0,
      accuracy: 5,
      capturedAt: "2026-09-10T13:00:00Z",
    },
  ];
  for (const body of bodies) {
    const result = parseLocationRequest(body);
    assert(result && "campId" in result && result.campId === campId);
    assert(!("occurrenceId" in result));
  }
  for (
    const body of [
      { action: "status", campId },
      { action: "status", ...target, occurrenceId: campId },
      { action: "start", ...target, requestId },
      { action: "start", ...target, requestId, consent: false },
      { action: "read", ...target },
      {
        action: "update",
        ...target,
        sessionId,
        latitude: 0,
        longitude: 0,
        accuracy: -1,
        capturedAt: "2026-09-10T13:00:00Z",
      },
    ]
  ) assert(parseLocationRequest(body) === null);
});

Deno.test("discovery and attendance reject spoofed identity and extra fields", () => {
  const bodies = [
    { action: "list" },
    { action: "participants", campId },
    { action: "arrive", campId, enrollmentId },
    { action: "depart", campId, enrollmentId },
  ];
  for (const body of bodies) {
    assert(parseLocationRequest(body));
    for (
      const extra of [{ actorId: coachId }, { coachId }, { latitude: 0 }, {
        occurrenceId: campId,
      }]
    ) {
      assert(parseLocationRequest({ ...body, ...extra }) === null);
    }
  }
  assert(parseLocationRequest({ action: "arrive", campId }) === null);
  assert(
    parseLocationRequest({ action: "depart", campId, enrollmentId: "bad" }) ===
      null,
  );
  assert(
    parseLocationRequest({ action: "participants", campId, enrollmentId }) ===
      null,
  );
  assert(parseLocationRequest({ action: "list", campId }) === null);
});

Deno.test("camp operations use JWT actor and preserve private non-location responses", async () => {
  const handler = locationHandler({
    getActor: async () => ({ id: coachId }),
    transact: async (actor, payload) => {
      assert(
        actor === coachId && payload.action === "participants" &&
          payload.campId === campId,
      );
      return {
        success: true,
        participants: [],
        startsAt: "2026-09-09T21:00:00Z",
        endsAt: "2026-09-11T21:00:00Z",
        canShare: true,
      };
    },
  });
  const response = await handler(
    new Request("https://test.local", {
      method: "POST",
      body: JSON.stringify({ action: "participants", campId }),
    }),
  );
  assert(response.status === 200);
  assert(response.headers.get("Cache-Control") === "no-store, private");
  const result = await response.json();
  assert(result.canShare === true && Array.isArray(result.participants));
  assert(!("location" in result));
});
