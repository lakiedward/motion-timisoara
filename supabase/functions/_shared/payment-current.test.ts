import { currentPayment } from "./payment-current.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("a single payment stays the current payment", () => {
  const only = { id: "a", status: "SUCCEEDED" };
  assertEquals(currentPayment([only]), only);
});

Deno.test("the open renewal is the current payment", () => {
  const rows = [
    { id: "first", status: "SUCCEEDED", created_at: "2026-11-01T10:00:00Z" },
    { id: "renewal", status: "PENDING", created_at: "2026-11-20T10:00:00Z" },
  ];
  assertEquals(currentPayment(rows)?.id, "renewal");
});

Deno.test("without an open payment the newest one is current", () => {
  const rows = [
    { id: "renewal", status: "SUCCEEDED", created_at: "2026-11-20T10:00:00Z" },
    { id: "first", status: "SUCCEEDED", created_at: "2026-11-01T10:00:00Z" },
  ];
  assertEquals(currentPayment(rows)?.id, "renewal");
});

Deno.test("two open payments need a manual check", () => {
  const rows = [
    { id: "a", status: "PENDING", created_at: "2026-11-01T10:00:00Z" },
    { id: "b", status: "FAILED", created_at: "2026-11-02T10:00:00Z" },
  ];
  assertEquals(currentPayment(rows), null);
});

Deno.test("several payments without dates need a manual check", () => {
  assertEquals(currentPayment([{ status: "SUCCEEDED" }, { status: "REFUNDED" }]), null);
  assertEquals(currentPayment([]), null);
});
