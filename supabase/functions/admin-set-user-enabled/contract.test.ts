import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  adminSetEnabledHandler,
  type AdminSetEnabledServices,
  AUTH_BAN_DURATION,
  parseSetEnabledRequest,
} from "./handler.ts";

const ADMIN_ID = "00000000-0000-4000-8000-0000000000a1";
const COACH_ID = "00000000-0000-4000-8000-0000000000c1";

function setup(overrides: Partial<AdminSetEnabledServices> = {}) {
  const calls: string[] = [];
  const services: AdminSetEnabledServices = {
    getUser: () => Promise.resolve({ id: ADMIN_ID }),
    getUserRole: () => Promise.resolve("ADMIN"),
    getTarget: () => Promise.resolve({ deletedAt: null }),
    setAuthBan: (id, banned) => {
      calls.push(`ban:${id}:${banned}`);
      return Promise.resolve();
    },
    setProfileEnabled: (id, enabled) => {
      calls.push(`profile:${id}:${enabled}`);
      return Promise.resolve();
    },
    ...overrides,
  };
  return { calls, handler: adminSetEnabledHandler(services) };
}

function post(body: unknown) {
  return new Request("http://localhost/admin-set-user-enabled", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

Deno.test("parseSetEnabledRequest validates the user id and the flag", () => {
  assertEquals(parseSetEnabledRequest(null), "Cererea nu este validă.");
  assertEquals(parseSetEnabledRequest({ userId: "x", enabled: false }), "Utilizatorul nu este valid.");
  assertEquals(
    parseSetEnabledRequest({ userId: COACH_ID, enabled: "false" }),
    "Alege dacă activezi sau dezactivezi contul.",
  );
  assertEquals(parseSetEnabledRequest({ userId: COACH_ID, enabled: false }), {
    userId: COACH_ID,
    enabled: false,
  });
});

Deno.test("the ban lasts a hundred years, like a deleted account", () => {
  assertEquals(AUTH_BAN_DURATION, "876000h");
});

Deno.test("only a live ADMIN role may change an account", async () => {
  for (const role of ["COACH", "CLUB", "PARENT", null]) {
    const { calls, handler } = setup({ getUserRole: () => Promise.resolve(role) });
    assertEquals((await handler(post({ userId: COACH_ID, enabled: false }))).status, 403);
    assertEquals(calls, []);
  }
  assertEquals((await setup().handler(new Request("http://localhost", { method: "GET" }))).status, 405);
});

Deno.test("deactivation bans the account in Auth before the profile changes", async () => {
  const { calls, handler } = setup();
  const response = await handler(post({ userId: COACH_ID, enabled: false }));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { userId: COACH_ID, enabled: false });
  assertEquals(calls, [`ban:${COACH_ID}:true`, `profile:${COACH_ID}:false`]);
});

Deno.test("reactivation lifts the Auth ban before the profile changes", async () => {
  const { calls, handler } = setup();
  const response = await handler(post({ userId: COACH_ID, enabled: true }));
  assertEquals(response.status, 200);
  assertEquals(calls, [`ban:${COACH_ID}:false`, `profile:${COACH_ID}:true`]);
});

Deno.test("an admin cannot deactivate their own account", async () => {
  const { calls, handler } = setup();
  assertEquals((await handler(post({ userId: ADMIN_ID, enabled: false }))).status, 409);
  assertEquals(calls, []);
});

Deno.test("deleted and missing accounts are refused without touching Auth", async () => {
  const deleted = setup({ getTarget: () => Promise.resolve({ deletedAt: "2026-11-01T10:00:00Z" }) });
  assertEquals((await deleted.handler(post({ userId: COACH_ID, enabled: true }))).status, 409);
  assertEquals(deleted.calls, []);
  const missing = setup({ getTarget: () => Promise.resolve(null) });
  assertEquals((await missing.handler(post({ userId: COACH_ID, enabled: false }))).status, 404);
  assertEquals(missing.calls, []);
});

Deno.test("an Auth failure leaves the profile unchanged", async () => {
  const { calls, handler } = setup({ setAuthBan: () => Promise.reject(new Error("boom")) });
  assertEquals((await handler(post({ userId: COACH_ID, enabled: false }))).status, 502);
  assertEquals(calls, []);
});

Deno.test("a failed profile save after the ban asks for the same button again", async () => {
  const { handler } = setup({ setProfileEnabled: () => Promise.reject(new Error("db down")) });
  const response = await handler(post({ userId: COACH_ID, enabled: false }));
  assertEquals(response.status, 503);
  assertEquals(
    (await response.json()).error,
    "Contul e blocat în Auth, dar profilul a rămas activ. Apasă din nou Dezactivează.",
  );
});

Deno.test("an invalid body is rejected before any lookup", async () => {
  const { calls, handler } = setup({
    getTarget: () => {
      calls.push("target");
      return Promise.resolve({ deletedAt: null });
    },
  });
  assertEquals((await handler(post({ userId: COACH_ID }))).status, 400);
  assertEquals(calls, []);
});
