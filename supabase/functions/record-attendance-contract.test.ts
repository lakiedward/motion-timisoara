import {
  attendanceHandler,
  attendanceResponse,
  parseAttendanceRequest,
} from "./record-attendance/contract.ts";

const id = "00000000-0000-0000-0000-000000000001";
const child = "00000000-0000-0000-0000-000000000002";
const token = "abcdef0123456789abcdef0123456789";
const manual = {
  requestId: id,
  occurrenceId: id,
  childId: child,
  status: "PRESENT",
};
function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const post = (body: unknown) =>
  new Request("https://local.test/record-attendance", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

Deno.test("valid manual statuses include clear and retain stable request IDs", () => {
  for (const status of ["PRESENT", "ABSENT", null]) {
    const parsed = parseAttendanceRequest({ ...manual, status });
    assert(parsed && parsed.requestId === id && parsed.status === status);
  }
});

Deno.test("QR is exactly the existing child token and cannot set absent or clear", () => {
  const qr = {
    requestId: id,
    occurrenceId: id,
    qrToken: token,
    status: "PRESENT",
  };
  assert(parseAttendanceRequest(qr));
  for (
    const qrToken of [
      `MT1:${token}`,
      token.toUpperCase(),
      "",
      "https://example.com",
    ]
  ) {
    assert(parseAttendanceRequest({ ...qr, qrToken }) === null);
  }
  assert(parseAttendanceRequest({ ...qr, status: "ABSENT" }) === null);
  assert(parseAttendanceRequest({ ...qr, status: null }) === null);
});

Deno.test("bulk requires unmarked-only, is bounded, and canonicalizes order and duplicates", () => {
  const bulk = {
    requestId: id,
    occurrenceId: id,
    childIds: [child, id, child],
    status: "PRESENT",
    onlyUnmarked: true,
  };
  const parsed = parseAttendanceRequest(bulk);
  assert(
    parsed && "childIds" in parsed &&
      JSON.stringify(parsed.childIds) === JSON.stringify([id, child]),
  );
  for (
    const invalid of [
      { onlyUnmarked: false },
      { onlyUnmarked: undefined },
      { childIds: [] },
      { childIds: Array(201).fill(id) },
      { childIds: [null] },
    ]
  ) {
    assert(parseAttendanceRequest({ ...bulk, ...invalid }) === null);
  }
});

Deno.test("rejects ambiguous payloads, missing statuses and caller-selected identities", () => {
  for (
    const invalid of [
      null,
      [],
      {},
      { ...manual, requestId: "x" },
      { ...manual, occurrenceId: null },
      { ...manual, status: undefined },
      { ...manual, status: false },
      { ...manual, actorId: child },
      { ...manual, qrToken: token },
      { ...manual, childIds: [id] },
    ]
  ) {
    assert(parseAttendanceRequest(invalid) === null);
  }
});

Deno.test("actor is supplied exclusively by authenticated dependency and body is normalized", async () => {
  let calls = 0;
  const handler = attendanceHandler({
    getActor: async () => ({ id: "verified-actor" }),
    record: async (actor, payload) => {
      calls++;
      assert(actor === "verified-actor" && payload.requestId === id);
      return { success: true, outcome: "recorded", childName: "Copil Audit" };
    },
  });
  const response = await handler(post(manual));
  assert(
    response.status === 200 &&
      (await response.json()).childName === "Copil Audit" && calls === 1,
  );
  assert(
    (await handler(post({ ...manual, actorId: child }))).status === 400 &&
      calls === 1,
  );
});

Deno.test("authentication failure pauses without parsing or recording", async () => {
  const handler = attendanceHandler({
    getActor: async () => {
      throw new Response("", { status: 401 });
    },
    record: () => {
      throw new Error("Must not record");
    },
  });
  const response = await handler(post(manual));
  assert(
    response.status === 401 && (await response.json()).code === "UNAUTHORIZED",
  );
});

Deno.test("malformed JSON is definitive and server failures retry without leaking detail", async () => {
  const handler = attendanceHandler({
    getActor: async () => ({ id }),
    record: () => {
      throw new Error("secret database detail");
    },
  });
  assert(
    (await handler(
      new Request("https://local.test", { method: "POST", body: "{" }),
    )).status === 400,
  );
  const response = await handler(post(manual));
  const body = await response.text();
  assert(
    response.status === 500 && body.includes("SERVER_ERROR") &&
      !body.includes("secret"),
  );
  assert((await handler(new Request("https://local.test"))).status === 405);
});

Deno.test("definitive business rejections and duplicates have stable response contracts", async () => {
  for (
    const code of [
      "MANUAL_OVERRIDE",
      "NOT_ENROLLED",
      "AMBIGUOUS_ENROLLMENT",
      "NO_REMAINING_SESSIONS",
      "REQUEST_CONFLICT",
    ]
  ) {
    const response = attendanceResponse({ success: false, code });
    const body = await response.json();
    assert(
      response.status === 409 && body.success === false && body.code === code &&
        body.message.length > 0,
    );
  }
  assert(
    attendanceResponse({ success: false, code: "FORBIDDEN" }).status === 403,
  );
  assert(
    attendanceResponse({ success: false, code: "INVALID_QR" }).status === 400,
  );
  assert(
    attendanceResponse({ success: false, code: "unexpected secret" }).status ===
      500,
  );
  const duplicate = attendanceResponse({ success: true, outcome: "duplicate" });
  assert(
    duplicate.status === 200 &&
      (await duplicate.json()).outcome === "duplicate",
  );
});
