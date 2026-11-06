import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { activeRole } from "./active-role.ts";

Deno.test("an enabled account that is not deleted keeps its role", () => {
  assertEquals(
    activeRole({ role: "ADMIN", enabled: true, deleted_at: null }),
    "ADMIN",
  );
});

Deno.test("a disabled, deleted or missing account has no role", () => {
  assertEquals(
    activeRole({ role: "ADMIN", enabled: false, deleted_at: null }),
    null,
  );
  assertEquals(
    activeRole({ role: "ADMIN", enabled: null, deleted_at: null }),
    null,
  );
  assertEquals(
    activeRole({
      role: "ADMIN",
      enabled: true,
      deleted_at: "2026-11-06T09:00:00Z",
    }),
    null,
  );
  assertEquals(activeRole(null), null);
  assertEquals(activeRole(undefined), null);
});
