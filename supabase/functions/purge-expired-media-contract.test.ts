import { isServiceCaller } from "./purge-expired-media/auth.ts";

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function jwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`;
}

Deno.test("accepts the configured service key", () => {
  assertEquals(isServiceCaller("Bearer sb_secret_abc", "sb_secret_abc"), true, "exact key");
});

Deno.test("accepts a service_role JWT the gateway already verified", () => {
  assertEquals(
    isServiceCaller(`Bearer ${jwt({ role: "service_role" })}`, "sb_secret_other"),
    true,
    "legacy service_role JWT",
  );
});

Deno.test("refuses anon and user tokens", () => {
  assertEquals(isServiceCaller(`Bearer ${jwt({ role: "anon" })}`, "key"), false, "anon");
  assertEquals(isServiceCaller(`Bearer ${jwt({ role: "authenticated" })}`, "key"), false, "user");
});

Deno.test("refuses missing, malformed and empty credentials", () => {
  assertEquals(isServiceCaller(null, "key"), false, "missing");
  assertEquals(isServiceCaller("Basic abc", "key"), false, "scheme");
  assertEquals(isServiceCaller("Bearer ", "key"), false, "empty");
  assertEquals(isServiceCaller("Bearer not-a-jwt", "key"), false, "garbage");
  assertEquals(isServiceCaller("Bearer a.%%%.c", undefined), false, "bad payload");
});
