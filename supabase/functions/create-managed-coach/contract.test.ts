import {
  type ManagedCoachDependencies,
  managedCoachHandler,
  parseManagedCoach,
} from "./contract.ts";
import { createManagedCoachDependencies } from "./dependencies.ts";

const callerId = "00000000-0000-0000-0000-000000000001";
const userId = "00000000-0000-0000-0000-000000000002";
const coachProfileId = "00000000-0000-0000-0000-000000000003";
const clubId = "00000000-0000-0000-0000-000000000004";
const otherClubId = "00000000-0000-0000-0000-000000000005";
const sportId = "00000000-0000-0000-0000-000000000006";
const payload = { name: " Coach Test ", email: " coach@local.test " };

function assert(value: unknown, message = "Assertion failed"): asserts value {
  if (!value) throw new Error(message);
}

function post(
  body: unknown = payload,
  authorization = "Bearer validated-token",
) {
  return new Request("https://local.test/create-managed-coach", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  });
}

function fixture(overrides: Partial<ManagedCoachDependencies> = {}) {
  const calls: string[] = [];
  let creationId: string | undefined;
  let generatedPassword: string | undefined;
  const dependencies: ManagedCoachDependencies = {
    getCaller: (token) => {
      assert(token === "validated-token");
      calls.push("caller");
      return Promise.resolve({ id: callerId, role: "ADMIN" });
    },
    findOwnedClub: (id) => {
      assert(id === callerId);
      calls.push("owned-club");
      return Promise.resolve(clubId);
    },
    clubExists: (id) => {
      assert(id === otherClubId);
      calls.push("target-club");
      return Promise.resolve(true);
    },
    createUser: (input, password, marker) => {
      assert(input.name === "Coach Test" && input.email === "coach@local.test");
      calls.push("create");
      generatedPassword = password;
      creationId = marker;
      return Promise.resolve({ id: userId });
    },
    setCoachRole: (id) => {
      assert(id === userId);
      calls.push("role");
      return Promise.resolve();
    },
    createCoachProfile: (id) => {
      assert(id === userId);
      calls.push("profile");
      return Promise.resolve(coachProfileId);
    },
    addSports: (id, sports) => {
      assert(
        id === coachProfileId && sports.length === 1 && sports[0] === sportId,
      );
      calls.push("sports");
      return Promise.resolve();
    },
    addToClub: (id, target) => {
      assert(id === coachProfileId && [clubId, otherClubId].includes(target));
      calls.push(`roster:${target}`);
      return Promise.resolve();
    },
    verifyCreatedCoach: (id, profileId, email, marker) => {
      assert(
        id === userId && profileId === coachProfileId &&
          email === "coach@local.test" && marker === creationId,
      );
      calls.push("verify");
      return Promise.resolve(true);
    },
    deleteCreatedUser: (id, marker) => {
      assert(id === userId && marker === creationId);
      calls.push("cleanup");
      return Promise.resolve();
    },
    ...overrides,
  };
  return {
    calls,
    dependencies,
    getPassword: () => generatedPassword,
  };
}

Deno.test("managed coach validation retains optional free-form phone and deduplicates sports", () => {
  const parsed = parseManagedCoach({
    ...payload,
    phone: "+40 (0) 722 / contact",
    sportIds: [sportId, sportId],
    bio: "Bio",
  });
  assert(parsed?.name === "Coach Test" && parsed.email === "coach@local.test");
  assert(
    parsed.phone === "+40 (0) 722 / contact" && parsed.sportIds.length === 1,
  );
  assert(parseManagedCoach(payload)?.phone === undefined);
  for (
    const value of [
      null,
      [],
      {},
      { ...payload, name: " x " },
      { ...payload, email: "invalid" },
      { ...payload, phone: null },
      { ...payload, bio: 2 },
      { ...payload, sportIds: ["invalid"] },
      { ...payload, clubId: "invalid" },
      { ...payload, userId },
      { ...payload, role: "COACH" },
      { ...payload, app_metadata: { role: "COACH" } },
    ]
  ) assert(parseManagedCoach(value) === null);
});

Deno.test("standalone ADMIN success follows role, profile and live identity verification", async () => {
  const state = fixture();
  const response = await managedCoachHandler(state.dependencies)(post());
  const body = await response.json();
  assert(
    response.status === 200 && body.userId === userId && body.clubId === null,
  );
  assert(body.tempPassword === state.getPassword());
  assert(state.calls.join(",") === "caller,create,role,profile,verify");
});

Deno.test("CLUB is confined to its owned roster even with a different requested club", async () => {
  const state = fixture({
    getCaller: () => Promise.resolve({ id: callerId, role: "CLUB" }),
  });
  const response = await managedCoachHandler(state.dependencies)(post({
    ...payload,
    clubId: otherClubId,
    sportIds: [sportId, sportId],
  }));
  assert(response.status === 200 && (await response.json()).clubId === clubId);
  assert(
    state.calls.join(",") ===
      `owned-club,create,role,profile,sports,roster:${clubId},verify`,
  );
  const admin = fixture();
  const adminResponse = await managedCoachHandler(admin.dependencies)(post({
    ...payload,
    clubId: otherClubId,
  }));
  assert(adminResponse.status === 200);
  assert(admin.calls.includes(`roster:${otherClubId}`));
});

Deno.test("missing authentication and ineligible roles create or delete no identity", async () => {
  for (const header of ["", "validated-token", "Bearer "]) {
    const state = fixture();
    const response = await managedCoachHandler(state.dependencies)(
      post(payload, header),
    );
    assert(response.status === 401 && state.calls.length === 0);
  }
  for (const role of [null, "PARENT", "COACH"]) {
    const state = fixture({
      getCaller: () => Promise.resolve({ id: callerId, role }),
    });
    assert(
      (await managedCoachHandler(state.dependencies)(post())).status === 403,
    );
    assert(state.calls.length === 0);
  }
  const invalid = fixture({ getCaller: () => Promise.resolve(null) });
  assert(
    (await managedCoachHandler(invalid.dependencies)(post())).status === 401,
  );
});

Deno.test("malformed requests, missing clubs and unsupported methods never create Auth users", async () => {
  const state = fixture();
  const handler = managedCoachHandler(state.dependencies);
  assert((await handler(post({ ...payload, userId }))).status === 400);
  assert((await handler(new Request("https://local.test"))).status === 405);
  const malformed = new Request("https://local.test", {
    method: "POST",
    headers: { Authorization: "Bearer validated-token" },
    body: "{",
  });
  assert((await handler(malformed)).status === 400);
  assert(!state.calls.includes("create"));
  for (const role of ["CLUB", "ADMIN"]) {
    const absent = fixture({
      getCaller: () => Promise.resolve({ id: callerId, role }),
      findOwnedClub: () => Promise.resolve(null),
      clubExists: () => Promise.resolve(false),
    });
    const response = await managedCoachHandler(absent.dependencies)(post({
      ...payload,
      clubId: otherClubId,
    }));
    assert(response.status === 400 && absent.calls.length === 0);
  }
});

Deno.test("existing email is a conflict and never deletes an existing account", async () => {
  const state = fixture({
    createUser: () => Promise.resolve({ error: "ACCOUNT_EXISTS" }),
  });
  const response = await managedCoachHandler(state.dependencies)(post());
  assert(
    response.status === 409 &&
      (await response.json()).code === "ACCOUNT_EXISTS",
  );
  assert(state.calls.join(",") === "caller");
});

Deno.test("every mandatory setup failure removes only this request's new identity without returning credentials", async () => {
  const stages = [
    ["setCoachRole", "ROLE_SETUP_FAILED"],
    ["createCoachProfile", "COACH_PROFILE_FAILED"],
    ["addSports", "SPORTS_SETUP_FAILED"],
    ["addToClub", "CLUB_SETUP_FAILED"],
    ["verifyCreatedCoach", "VERIFICATION_FAILED"],
  ] as const;
  for (const [method, code] of stages) {
    const state = fixture({
      [method]: () => Promise.reject(new Error("private backend detail")),
    });
    const response = await managedCoachHandler(state.dependencies)(post({
      ...payload,
      clubId: otherClubId,
      sportIds: [sportId],
    }));
    const body = await response.json();
    assert(response.status === 500 && body.code === code);
    assert(
      !("tempPassword" in body) &&
        !JSON.stringify(body).includes("private backend detail"),
    );
    assert(state.calls.at(-1) === "cleanup");
    assert(state.calls.filter((call) => call === "cleanup").length === 1);
  }
});

Deno.test("unusable final profile and failed compensation cannot become a successful creation", async () => {
  const unready = fixture({ verifyCreatedCoach: () => Promise.resolve(false) });
  const response = await managedCoachHandler(unready.dependencies)(post());
  assert(
    response.status === 500 &&
      (await response.json()).code === "VERIFICATION_FAILED",
  );
  assert(unready.calls.at(-1) === "cleanup");
  const incomplete = fixture({
    createCoachProfile: () => Promise.reject(new Error("Profile failed")),
    deleteCreatedUser: () => Promise.reject(new Error("Cleanup failed")),
  });
  const failure = await managedCoachHandler(incomplete.dependencies)(post());
  const body = await failure.json();
  assert(failure.status === 500 && body.code === "CREATION_INCOMPLETE");
  assert(!("tempPassword" in body) && /administrator/i.test(body.error));
});

Deno.test("contradictory returned caller identity is neither promoted nor deleted", async () => {
  const state = fixture({
    createUser: () => Promise.resolve({ id: callerId }),
  });
  const response = await managedCoachHandler(state.dependencies)(post());
  assert(response.status === 500 && state.calls.join(",") === "caller");
});

type QueryResult = { data: unknown; error: unknown };

function databaseFixture(
  queryFailure?: (
    table: string,
    operation: string,
    columns: string,
  ) => QueryResult | undefined,
  authOptions: {
    confirmed?: boolean;
    owned?: boolean;
    cleanupError?: boolean;
  } = {},
) {
  let marker: string | undefined;
  const deleted: string[] = [];
  const writes: string[] = [];
  const client = {
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: callerId } }, error: null }),
      admin: {
        createUser: (
          input: { app_metadata: { managed_coach_creation_id: string } },
        ) => {
          marker = input.app_metadata.managed_coach_creation_id;
          writes.push("auth");
          return Promise.resolve({
            data: { user: { id: userId } },
            error: null,
          });
        },
        getUserById: (id: string) => {
          assert(id === userId);
          return Promise.resolve({
            data: {
              user: {
                id: userId,
                email: "coach@local.test",
                email_confirmed_at: authOptions.confirmed === false
                  ? null
                  : "2026-10-06T00:00:00Z",
                app_metadata: {
                  managed_coach_creation_id: authOptions.owned === false
                    ? "another-request"
                    : marker,
                },
              },
            },
            error: null,
          });
        },
        deleteUser: (id: string) => {
          assert(id === userId);
          deleted.push(id);
          return Promise.resolve({
            error: authOptions.cleanupError
              ? { message: "private cleanup detail" }
              : null,
          });
        },
      },
    },
    from: (table: string) => {
      let operation = "read";
      let columns = "";
      const result = (): QueryResult => {
        const error = queryFailure?.(table, operation, columns);
        if (error) return error;
        if (table === "profiles") {
          return {
            data: columns === "role,enabled"
              ? { role: "ADMIN", enabled: true }
              : { id: userId, role: "COACH", enabled: true },
            error: null,
          };
        }
        if (table === "coach_profiles") {
          return { data: { id: coachProfileId, user_id: userId }, error: null };
        }
        if (table === "clubs") {
          return { data: { id: otherClubId }, error: null };
        }
        if (table === "coach_sports") {
          return { data: [{ sport_id: sportId }], error: null };
        }
        if (table === "club_coaches") {
          return {
            data: { club_id: otherClubId, coach_profile_id: coachProfileId },
            error: null,
          };
        }
        throw new Error("Unexpected table");
      };
      const query = {
        select: (value: string) => {
          columns = value;
          return query;
        },
        eq: () => query,
        update: () => {
          operation = "update";
          writes.push(table);
          return query;
        },
        insert: () => {
          operation = "insert";
          writes.push(table);
          return query;
        },
        single: () => Promise.resolve(result()),
        maybeSingle: () => Promise.resolve(result()),
        then: (resolve: (value: QueryResult) => unknown) =>
          Promise.resolve(result()).then(resolve),
      };
      return query;
    },
  };
  const dependencies = createManagedCoachDependencies(
    client as unknown as Parameters<typeof createManagedCoachDependencies>[0],
  );
  return { dependencies, deleted, writes };
}

Deno.test("production adapter treats a failed coach_profiles insert as failure and compensates Auth", async () => {
  const state = databaseFixture((table, operation) =>
    table === "coach_profiles" && operation === "insert"
      ? { data: null, error: { message: "private insert detail" } }
      : undefined
  );
  const response = await managedCoachHandler(state.dependencies)(post());
  const body = await response.json();
  assert(response.status === 500 && body.code === "COACH_PROFILE_FAILED");
  assert(state.deleted.length === 1 && state.deleted[0] === userId);
  assert(
    !("tempPassword" in body) && !body.error.includes("private insert detail"),
  );
});

Deno.test("production adapter rejects missing or disabled COACH role and failed associations", async () => {
  const scenarios: [string, string, QueryResult, string][] = [
    ["profiles", "update", { data: null, error: null }, "ROLE_SETUP_FAILED"],
    ["profiles", "update", {
      data: { id: userId, role: "PARENT", enabled: true },
      error: null,
    }, "ROLE_SETUP_FAILED"],
    ["profiles", "update", {
      data: { id: userId, role: "COACH", enabled: false },
      error: null,
    }, "ROLE_SETUP_FAILED"],
    ["coach_sports", "insert", {
      data: null,
      error: { message: "failed sports" },
    }, "SPORTS_SETUP_FAILED"],
    ["club_coaches", "insert", {
      data: null,
      error: { message: "failed club" },
    }, "CLUB_SETUP_FAILED"],
  ];
  for (const [table, operation, result, code] of scenarios) {
    const state = databaseFixture((queryTable, queryOperation) =>
      queryTable === table && queryOperation === operation ? result : undefined
    );
    const response = await managedCoachHandler(state.dependencies)(post({
      ...payload,
      clubId: otherClubId,
      sportIds: [sportId],
    }));
    assert(response.status === 500 && (await response.json()).code === code);
    assert(state.deleted.length === 1);
  }
});

Deno.test("production adapter verifies confirmed Auth plus matching COACH profile before returning credentials", async () => {
  const state = databaseFixture();
  const response = await managedCoachHandler(state.dependencies)(post());
  assert(response.status === 200 && (await response.json()).userId === userId);
  assert(state.deleted.length === 0);
  const unconfirmed = databaseFixture(undefined, { confirmed: false });
  const failure = await managedCoachHandler(unconfirmed.dependencies)(post());
  assert(
    failure.status === 500 &&
      (await failure.json()).code === "VERIFICATION_FAILED",
  );
  assert(unconfirmed.deleted.length === 1);
});

Deno.test("production adapter refuses cleanup of an identity owned by another creation request", async () => {
  const state = databaseFixture(
    (table, operation) =>
      table === "coach_profiles" && operation === "insert"
        ? { data: null, error: { message: "failed profile" } }
        : undefined,
    { owned: false },
  );
  const response = await managedCoachHandler(state.dependencies)(post());
  assert(
    response.status === 500 &&
      (await response.json()).code === "CREATION_INCOMPLETE",
  );
  assert(state.deleted.length === 0);
});

Deno.test("production adapter denies disabled ADMIN and CLUB callers before creating any identity", async () => {
  for (const role of ["ADMIN", "CLUB"]) {
    const state = databaseFixture((table, operation, columns) =>
      table === "profiles" && operation === "read" && columns === "role,enabled"
        ? { data: { role, enabled: false }, error: null }
        : undefined
    );
    const response = await managedCoachHandler(state.dependencies)(post());
    assert(
      response.status === 403 && (await response.json()).code === "FORBIDDEN",
    );
    assert(state.writes.length === 0 && state.deleted.length === 0);
  }
});

Deno.test("production adapter rejects final disabled or mismatched profiles and reports failed compensation", async () => {
  const finalResults: QueryResult[] = [
    { data: null, error: null },
    { data: { id: userId, role: "PARENT", enabled: true }, error: null },
    { data: { id: userId, role: "COACH", enabled: false }, error: null },
    { data: { id: callerId, role: "COACH", enabled: true }, error: null },
  ];
  for (const result of finalResults) {
    const state = databaseFixture((table, operation, columns) =>
      table === "profiles" && operation === "read" &&
        columns === "id,role,enabled"
        ? result
        : undefined
    );
    const response = await managedCoachHandler(state.dependencies)(post());
    assert(
      response.status === 500 &&
        (await response.json()).code === "VERIFICATION_FAILED",
    );
    assert(state.deleted.length === 1);
  }
  const incomplete = databaseFixture(
    (table, operation) =>
      table === "coach_profiles" && operation === "insert"
        ? { data: null, error: { message: "failed profile" } }
        : undefined,
    { cleanupError: true },
  );
  const response = await managedCoachHandler(incomplete.dependencies)(post());
  const body = await response.json();
  assert(response.status === 500 && body.code === "CREATION_INCOMPLETE");
  assert(!("tempPassword" in body) && incomplete.deleted.length === 1);
});
