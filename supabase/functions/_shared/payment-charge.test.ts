import { authorizedRonCharge } from "./payment-charge.ts";
import { createPriceSnapshot } from "./price-snapshot.ts";

const enrollment = { kind: "COURSE", entity_id: "offer", child_id: "child" };
const db = {
  from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { parent_id: "parent" }, error: null }) }) }) }),
} as unknown as Parameters<typeof authorizedRonCharge>[0];

async function rejected(run: () => Promise<unknown>, status: number) {
  try { await run(); } catch (error) {
    if (error instanceof Response && error.status === status) return;
    throw error;
  }
  throw new Error(`Expected rejection ${status}`);
}

Deno.test("charge uses the saved RON value and accepts a verified source EUR snapshot", async () => {
  const pricing_snapshot = await createPriceSnapshot("COURSE", "offer", "child", 10000, "EUR", 5123456, 3);
  const payment = { amount: 153704, currency: "RON", status: "PENDING", pricing_snapshot };
  if (await authorizedRonCharge(db, "parent", enrollment, payment) !== 153704) throw new Error("Wrong charge");
  await rejected(() => authorizedRonCharge(db, "stranger", enrollment, payment), 403);
});

Deno.test("charge fails closed on malformed snapshots, foreign binding and mismatched saved amount", async () => {
  const pricing_snapshot = await createPriceSnapshot("COURSE", "offer", "child", 10000, "EUR", 5000000, 1);
  const payment = { amount: 50000, currency: "RON", status: "PENDING", pricing_snapshot };
  for (const patch of [
    { amount: 1 }, { pricing_snapshot: {} }, { pricing_snapshot: { ...pricing_snapshot, quantity: 2 } },
    { pricing_snapshot: await createPriceSnapshot("COURSE", "offer", "other", 10000, "EUR", 5000000, 1) },
  ]) await rejected(() => authorizedRonCharge(db, "parent", enrollment, { ...payment, ...patch }), 409);
});

Deno.test("legacy charge must already be RON and satisfy the Stripe integer amount range", async () => {
  const payment = { amount: 10000, currency: "RON", status: "PENDING" };
  if (await authorizedRonCharge(db, "parent", enrollment, payment) !== 10000) throw new Error("Legacy amount changed");
  if (await authorizedRonCharge(db, "parent", enrollment, { ...payment, status: "SUCCEEDED", gateway_txn_id: "pi_paid" }) !== 10000) {
    throw new Error("Paid gateway must remain inspectable for alreadySucceeded response");
  }
  for (const patch of [
    { currency: "EUR" }, { currency: "" }, { amount: 0 }, { amount: -1 }, { amount: 1.5 },
    { amount: 100000000 }, { amount: NaN }, { status: "REFUNDED" }, { status: "CANCELLED" }, { status: "SUCCEEDED" },
  ]) await rejected(() => authorizedRonCharge(db, "parent", enrollment, { ...payment, ...patch }), 409);
});
