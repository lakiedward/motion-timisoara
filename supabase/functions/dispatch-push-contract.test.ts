import {
  type Dispatcher,
  parsePushDelivery,
  type PushDelivery,
  pushDispatcher,
  type PushOutcome,
} from "./dispatch-push/contract.ts";
import {
  firebaseMessaging,
  googleAssertion,
} from "./dispatch-push/firebase.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
const id = "00000000-0000-4000-8000-000000000001";
const leaseId = "00000000-0000-4000-8000-000000000002";
const secret = "test-dispatch-secret-never-valid-in-production";
const payload = (): PushDelivery => ({
  token: "test-token-abcdefghijklmnopqrstuvwxyz",
  ttlSeconds: 3600,
  data: {
    eventId: id,
    bindingId: id,
    kind: "announcement",
    entityId: id,
    path: "/account/announcements",
    title: "Anunț nou",
    body: "Ai un anunț nou în Motion.",
    expiresAt: String(Date.now() + 3600_000),
  },
});
const post = (body = "{}", key: string | null = secret) =>
  new Request("https://local.test/dispatch-push", {
    method: "POST",
    body,
    headers: key ? { "x-push-dispatch-secret": key } : {},
  });
function harness(overrides: Partial<Dispatcher> = {}) {
  const settled: PushOutcome[] = [];
  const calls: string[] = [];
  const deps: Dispatcher = {
    secret,
    authorize: () => {
      calls.push("authorize");
      return Promise.resolve("test-access-token");
    },
    claim: () => {
      calls.push("claim");
      return Promise.resolve([{ deliveryId: id, leaseId }]);
    },
    prepare: () => {
      calls.push("prepare");
      return Promise.resolve(payload());
    },
    send: () => {
      calls.push("send");
      return Promise.resolve({ outcome: "sent", code: "FCM_ACCEPTED" });
    },
    finish: (_claim, outcome) => {
      calls.push("finish");
      settled.push(outcome);
      return Promise.resolve();
    },
    ...overrides,
  };
  return { handle: pushDispatcher(deps), settled, calls };
}

Deno.test("dispatcher refuses absent, wrong and missing configured secrets before database access", async () => {
  for (const supplied of [null, "", "wrong", secret + "x"]) {
    const test = harness();
    assert((await test.handle(post("{}", supplied))).status === 401);
    assert(test.calls.length === 0);
  }
  assert((await harness({ secret: undefined }).handle(post())).status === 401);
  assert(
    (await harness().handle(
      new Request("https://local.test", { method: "GET" }),
    )).status === 405,
  );
});

Deno.test("dispatcher rejects caller supplied recipients, payloads, arrays and malformed bodies", async () => {
  for (
    const body of ['{"token":"chosen"}', "[]", "null", "{", "x".repeat(1025)]
  ) {
    const test = harness();
    assert((await test.handle(post(body))).status === 400);
    assert(test.calls.length === 0);
  }
});

Deno.test("dispatcher authorizes OAuth before claiming and prepares immediately before sending", async () => {
  const test = harness();
  const response = await test.handle(post());
  assert(response.status === 200);
  assert(test.calls.join() === "authorize,claim,prepare,send,finish");
  assert(test.settled[0].outcome === "sent");
  const result = await response.text();
  assert(!result.includes("token") && !result.includes(id));
});

Deno.test("revoked or no longer eligible delivery never reaches Firebase", async () => {
  const test = harness({ prepare: () => Promise.resolve(null) });
  const response = await test.handle(post());
  assert(
    response.status === 200 && !test.calls.includes("send") &&
      !test.calls.includes("finish"),
  );
});

Deno.test("network uncertainty becomes bounded database retry without leaking error text", async () => {
  const test = harness({
    send: () => Promise.reject(new Error("private-token-and-child")),
  });
  const response = await test.handle(post());
  assert(
    test.settled[0].outcome === "retry" &&
      test.settled[0].code === "FCM_NETWORK",
  );
  assert(!(await response.text()).includes("private-token"));
});

Deno.test("database failures preserve the lease for recovery and return sanitized failure", async () => {
  const test = harness({
    finish: () => Promise.reject(new Error("private-sql-value")),
  });
  const response = await test.handle(post());
  assert(
    response.status === 503 &&
      !(await response.text()).includes("private-sql-value"),
  );
  const authFail = harness({
    authorize: () => Promise.reject(new Error("private-key")),
  });
  assert(
    (await authFail.handle(post())).status === 503 &&
      authFail.calls.length === 0,
  );
});

Deno.test("invalid privileged payload is dead lettered instead of sent", async () => {
  const test = harness({
    prepare: () =>
      Promise.resolve({
        ...payload(),
        data: { ...payload().data, path: "https://attacker.test" },
      }),
  });
  assert((await test.handle(post())).status === 200);
  assert(
    !test.calls.includes("send") && test.settled[0].code === "INVALID_PAYLOAD",
  );
});

Deno.test("payload validates exact route by kind and UUID, with safe camp list fallback", () => {
  const p = payload();
  for (
    const [kind, path] of [
      ["announcement", "/account/announcements"],
      ["attendance", "/account/attendance"],
      ["course", `/cursuri/${id}`],
      ["camp", "/tabere/--tabara--"],
      ["camp", "/tabere"],
    ]
  ) {
    assert(parsePushDelivery({ ...p, data: { ...p.data, kind, path } }));
  }
  for (
    const path of [
      "//evil.test",
      "/account/announcements?returnUrl=/admin",
      "/account/announcements#x",
      "/admin",
      "/cursuri/invalid",
    ]
  ) {
    assert(parsePushDelivery({ ...p, data: { ...p.data, path } }) === null);
  }
  assert(
    parsePushDelivery({
      ...p,
      data: { ...p.data, kind: "camp", path: "/tabere/../admin" },
    }) === null,
  );
  assert(
    parsePushDelivery({
      ...p,
      data: { ...p.data, kind: "camp", path: "/tabere/a%2Fb" },
    }) === null,
  );
});

Deno.test("payload rejects expiry, non-string extras, invalid ids, excessive TTL and oversized text", () => {
  const p = payload();
  for (
    const data of [
      { ...p.data, expiresAt: String(Date.now() - 1) },
      { ...p.data, bindingId: "another" },
      { ...p.data, privateContent: "unexpected" },
      { ...p.data, title: "x".repeat(101) },
      { ...p.data, body: 42 },
    ]
  ) assert(parsePushDelivery({ ...p, data }) === null);
  for (const ttlSeconds of [0, -1, 3601, 1.5, "60"]) {
    assert(parsePushDelivery({ ...p, ttlSeconds }) === null);
  }
  assert(
    parsePushDelivery({
      ...p,
      data: { ...p.data, expiresAt: String(Date.now() + 50_000) },
    })!.ttlSeconds <= 50,
  );
});

async function testAccount() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const raw = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  const pem = `-----BEGIN PRIVATE KEY-----\n${
    btoa(String.fromCharCode(...raw))
  }\n-----END PRIVATE KEY-----\n`;
  return {
    publicKey: pair.publicKey,
    raw: JSON.stringify({
      type: "service_account",
      project_id: "motion-test-326",
      client_email: "test@motion-test-326.iam.gserviceaccount.com",
      private_key: pem,
    }),
  };
}

Deno.test("Google assertion is verifiable RS256 with exact audience, scope and bounded lifetime", async () => {
  const account = await testAccount();
  const result = await googleAssertion(account.raw, 1_800_000_000_000);
  const [header, body, signature] = result.assertion.split(".");
  const decode = (part: string) =>
    Uint8Array.from(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
      (char) => char.charCodeAt(0),
    );
  const claims = JSON.parse(new TextDecoder().decode(decode(body)));
  assert(claims.aud === "https://oauth2.googleapis.com/token");
  assert(claims.scope === "https://www.googleapis.com/auth/firebase.messaging");
  assert(
    claims.exp - claims.iat <= 3600 && result.projectId === "motion-test-326",
  );
  assert(
    await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      account.publicKey,
      decode(signature),
      new TextEncoder().encode(`${header}.${body}`),
    ),
  );
});

Deno.test("Firebase sends data-only high priority with TTL and package restriction and caches OAuth", async () => {
  const account = await testAccount();
  let authCalls = 0;
  let sent: Record<string, unknown> | null = null;
  const client = firebaseMessaging(
    account.raw,
    ((input, init) => {
      if (String(input) === "https://oauth2.googleapis.com/token") {
        authCalls++;
        assert(String(init?.body).includes("jwt-bearer"));
        return Promise.resolve(Response.json({
          access_token: "ephemeral-access",
          expires_in: 3600,
        }));
      }
      assert(
        String(input) ===
          "https://fcm.googleapis.com/v1/projects/motion-test-326/messages:send",
      );
      sent = JSON.parse(init?.body as string);
      return Promise.resolve(
        Response.json({ name: "projects/motion-test-326/messages/test" }),
      );
    }) as typeof fetch,
  );
  const access = await client.authorize();
  assert(await client.authorize() === access && authCalls === 1);
  assert((await client.send(payload(), access)).outcome === "sent");
  const message =
    (sent as unknown as { message: Record<string, unknown> }).message;
  assert(!("notification" in message));
  const android = message.android as Record<string, unknown>;
  assert(
    android.priority === "high" && android.ttl === "3600s" &&
      android.restricted_package_name === "com.motiontimisoara.app",
  );
});

Deno.test("Firebase distinguishes invalid tokens, quota retry and permanent payload errors", async () => {
  const account = await testAccount();
  for (
    const [status, result, headers, expected] of [
      [
        404,
        {
          error: {
            details: [{
              "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
              errorCode: "UNREGISTERED",
            }],
          },
        },
        {},
        "invalid_token",
      ],
      [400, { error: { status: "INVALID_ARGUMENT" } }, {}, "failed"],
      [429, { error: {} }, { "Retry-After": "300" }, "retry"],
      [503, { error: {} }, {}, "retry"],
      [401, { error: {} }, {}, "retry"],
    ] as const
  ) {
    const client = firebaseMessaging(
      account.raw,
      (() =>
        Promise.resolve(
          Response.json(result, { status, headers }),
        )) as typeof fetch,
    );
    const outcome = await client.send(payload(), "test-access");
    assert(outcome.outcome === expected);
    if (status === 429) assert(outcome.retryAfter === 300);
  }
});

Deno.test("Firebase OAuth failure does not surface upstream private errors", async () => {
  const account = await testAccount();
  const client = firebaseMessaging(
    account.raw,
    (() =>
      Promise.resolve(Response.json({ error: "private-value" }, {
        status: 400,
      }))) as typeof fetch,
  );
  try {
    await client.authorize();
    throw new Error("Expected failure");
  } catch (error) {
    assert(
      error instanceof Error &&
        error.message === "FCM authorization unavailable",
    );
  }
});
