import {
  coachInvitationDatabaseFailure,
  coachInvitationParameters,
  invitationAvailability,
  parseCoachInvitation,
  parseCoachInvitationResult,
} from "./_shared/coach-invitation.ts";
import {
  type CoachRedemptionDependencies,
  coachRedemptionHandler,
} from "./redeem-coach-invitation/contract.ts";
import {
  parseRegisterCoach,
  type RegisterCoachDependencies,
  registerCoachHandler,
} from "./register-coach/contract.ts";

const actorId = "00000000-0000-0000-0000-000000000001";
const coachProfileId = "00000000-0000-0000-0000-000000000002";
const sportId = "00000000-0000-0000-0000-000000000003";
const invitation = {
  invitationCode: " INVITE ",
  name: " Coach Test ",
  sportIds: [sportId, sportId],
};
const passwordRequest = {
  ...invitation,
  email: "coach@local.test",
  password: "local-test-only",
};
const success = { coachProfileId, alreadyCoach: false };

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

function post(body: unknown, authorization = "Bearer validated-user-jwt") {
  return new Request("https://local.test/redeem-coach-invitation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("coach details are bounded, normalized and deduplicated without identity claims", () => {
  const parsed = parseCoachInvitation({
    ...invitation,
    phone: " 0722 ",
    bio: " Bio ",
  });
  assert(parsed?.invitationCode === "INVITE" && parsed.name === "Coach Test");
  assert(
    parsed.phone === "0722" && parsed.bio === "Bio" &&
      parsed.sportIds.length === 1,
  );
  assert(
    parseCoachInvitation({ invitationCode: "I", name: "Co" })?.sportIds
      .length === 0,
  );
  for (
    const value of [
      null,
      [],
      {},
      { ...invitation, userId: actorId },
      { ...invitation, email: "other@local.test" },
      { ...invitation, role: "COACH" },
      { ...invitation, metadata: { role: "COACH" } },
      { ...invitation, invitationCode: " " },
      { ...invitation, name: "x" },
      { ...invitation, invitationCode: "x".repeat(201) },
      { ...invitation, name: "x".repeat(201) },
      { ...invitation, phone: null },
      { ...invitation, phone: "x".repeat(51) },
      { ...invitation, bio: "x".repeat(4001) },
      { ...invitation, sportIds: ["bad"] },
      { ...invitation, sportIds: Array(51).fill(sportId) },
    ]
  ) assert(parseCoachInvitation(value) === null);
});

Deno.test("RPC parameters derive identity exclusively from authenticated actor", async () => {
  let authCalls = 0;
  let writes = 0;
  const handler = coachRedemptionHandler({
    getActor: (request) => {
      authCalls++;
      assert(
        request.headers.get("Authorization") === "Bearer validated-user-jwt",
      );
      return Promise.resolve({ id: actorId });
    },
    redeem: (id, payload) => {
      writes++;
      const rpc = coachInvitationParameters(id, payload);
      assert(rpc.p_user_id === actorId && rpc.p_invitation_code === "INVITE");
      assert(
        rpc.p_sport_ids.length === 1 && rpc.p_phone === null &&
          rpc.p_bio === null,
      );
      return Promise.resolve({ data: success });
    },
  });
  const response = await handler(post(invitation));
  assert(
    response.status === 200 &&
      (await response.json()).coachProfileId === coachProfileId,
  );
  const forged = await handler(post({ ...invitation, userId: sportId }));
  assert(forged.status === 400 && authCalls === 2 && writes === 1);
});

Deno.test("missing, expired or invalid JWT never reaches the service RPC", async () => {
  for (const token of ["", "Bearer expired", "Bearer forged"]) {
    let writes = 0;
    const handler = coachRedemptionHandler({
      getActor: () =>
        Promise.reject(new Response("Unauthorized", { status: 401 })),
      redeem: () => {
        writes++;
        return Promise.resolve({ data: success });
      },
    });
    const response = await handler(post(invitation, token));
    assert(
      response.status === 401 &&
        (await response.json()).code === "UNAUTHORIZED",
    );
    assert(writes === 0);
  }
});

Deno.test("redemption protects malformed bodies and unsupported methods", async () => {
  let writes = 0;
  const handler = coachRedemptionHandler({
    getActor: () => Promise.resolve({ id: actorId }),
    redeem: () => {
      writes++;
      return Promise.resolve({ data: success });
    },
  });
  const invalid = new Request("https://local.test", {
    method: "POST",
    body: "{",
  });
  assert((await handler(invalid)).status === 400);
  assert(
    (await handler(new Request("https://local.test"))).status === 405 &&
      writes === 0,
  );
});

Deno.test("database denial statuses are meaningful and unknown details remain private", async () => {
  const statuses = {
    INVALID_INVITATION: 400,
    INVITATION_EXPIRED: 409,
    INVITATION_EXHAUSTED: 409,
    INVALID_SPORTS: 400,
    PROFILE_DISABLED: 403,
    ROLE_NOT_ELIGIBLE: 403,
    EMAIL_UNVERIFIED: 403,
    SERVER_ERROR: 500,
  } as const;
  for (const [error, status] of Object.entries(statuses)) {
    const deps: CoachRedemptionDependencies = {
      getActor: () => Promise.resolve({ id: actorId }),
      redeem: () => Promise.resolve({ error: error as keyof typeof statuses }),
    };
    const response = await coachRedemptionHandler(deps)(post(invitation));
    assert(
      response.status === status && (await response.json()).code === error,
    );
  }
  assert(
    coachInvitationDatabaseFailure({
      code: "42501",
      message: "PROFILE_DISABLED",
    }) === "PROFILE_DISABLED",
  );
  assert(
    coachInvitationDatabaseFailure({ code: "23503", message: "FK details" }) ===
      "INVALID_SPORTS",
  );
  assert(
    coachInvitationDatabaseFailure({
      code: "XX000",
      message: "private SQL details",
    }) === "SERVER_ERROR",
  );
});

Deno.test("successful repeat remains a successful response and preserves alreadyCoach", async () => {
  const handler = coachRedemptionHandler({
    getActor: () => Promise.resolve({ id: actorId }),
    redeem: () => Promise.resolve({ data: { ...success, alreadyCoach: true } }),
  });
  const result = await handler(post(invitation));
  assert(result.status === 200 && (await result.json()).alreadyCoach === true);
  assert(
    parseCoachInvitationResult({
      coachProfileId: "bad",
      alreadyCoach: false,
    }) === null,
  );
  assert(
    parseCoachInvitationResult({ coachProfileId, alreadyCoach: "true" }) ===
      null,
  );
});

function registrationDependencies(
  overrides: Partial<RegisterCoachDependencies> = {},
) {
  const calls: string[] = [];
  const dependencies: RegisterCoachDependencies = {
    preflight: () => {
      calls.push("preflight");
      return Promise.resolve(null);
    },
    createUser: () => {
      calls.push("create");
      return Promise.resolve({ id: actorId });
    },
    redeem: (id) => {
      assert(id === actorId);
      calls.push("redeem");
      return Promise.resolve({ data: success });
    },
    deleteCreatedUser: (id) => {
      assert(id === actorId);
      calls.push("cleanup");
      return Promise.resolve();
    },
    createStripeAccount: (id, profileId) => {
      assert(id === actorId && profileId === coachProfileId);
      calls.push("stripe");
      return Promise.resolve("acct_simulated");
    },
    ...overrides,
  };
  return { calls, dependencies };
}

Deno.test("password requests retain auth fields but reject role and caller identities", () => {
  assert(parseRegisterCoach(passwordRequest));
  for (
    const body of [
      { ...passwordRequest, email: "bad" },
      { ...passwordRequest, password: "tiny" },
      { ...passwordRequest, role: "ADMIN" },
      { ...passwordRequest, userId: actorId },
    ]
  ) assert(parseRegisterCoach(body) === null);
});

Deno.test("password registration shares the transaction and creates Stripe only afterwards", async () => {
  const fixture = registrationDependencies();
  const response = await registerCoachHandler(fixture.dependencies)(
    post(passwordRequest),
  );
  const body = await response.json();
  assert(
    response.status === 200 && body.userId === actorId &&
      body.stripeAccountId === "acct_simulated",
  );
  assert(fixture.calls.join(",") === "preflight,create,redeem,stripe");
});

Deno.test("invalid invitation preflight creates no Auth or Stripe record", async () => {
  const fixture = registrationDependencies({
    preflight: () => Promise.resolve("INVITATION_EXPIRED"),
  });
  const response = await registerCoachHandler(fixture.dependencies)(
    post(passwordRequest),
  );
  assert(response.status === 409 && fixture.calls.length === 0);
  const atExpiry = {
    expires_at: "2026-10-01T10:00:00Z",
    current_uses: 0,
    max_uses: 1,
  };
  assert(
    invitationAvailability(atExpiry, Date.parse(atExpiry.expires_at)) ===
      "INVITATION_EXPIRED",
  );
  assert(
    invitationAvailability({
      ...atExpiry,
      expires_at: null,
      current_uses: 1,
    }) === "INVITATION_EXHAUSTED",
  );
  assert(invitationAvailability(null) === "INVALID_INVITATION");
});

Deno.test("transaction failure removes only the newly created identity and never calls Stripe", async () => {
  const fixture = registrationDependencies({
    redeem: () => Promise.resolve({ error: "INVITATION_EXHAUSTED" }),
  });
  const response = await registerCoachHandler(fixture.dependencies)(
    post(passwordRequest),
  );
  assert(
    response.status === 409 &&
      fixture.calls.join(",") === "preflight,create,cleanup",
  );
  const throwing = registrationDependencies({
    redeem: () => Promise.reject(new Error("RPC failed")),
  });
  assert(
    (await registerCoachHandler(throwing.dependencies)(post(passwordRequest)))
      .status === 500,
  );
  assert(throwing.calls.join(",") === "preflight,create,cleanup");
});

Deno.test("existing email never triggers deletion and Stripe failure preserves successful coach", async () => {
  const existing = registrationDependencies({
    createUser: () => Promise.resolve({ error: "ACCOUNT_EXISTS" }),
  });
  assert(
    (await registerCoachHandler(existing.dependencies)(post(passwordRequest)))
      .status === 409,
  );
  assert(existing.calls.join(",") === "preflight");
  const unavailable = registrationDependencies({
    createStripeAccount: () => Promise.reject(new Error("No Stripe")),
  });
  const response = await registerCoachHandler(unavailable.dependencies)(
    post(passwordRequest),
  );
  assert(
    response.status === 200 && (await response.json()).stripeAccountId === null,
  );
  assert(!unavailable.calls.includes("cleanup"));
});
