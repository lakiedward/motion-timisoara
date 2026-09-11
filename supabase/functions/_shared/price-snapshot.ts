export interface PriceSnapshot {
  schemaVersion: 1;
  kind: "COURSE" | "CAMP" | "ACTIVITY";
  entityId: string;
  childId: string;
  sourceUnitAmount: number;
  sourceCurrency: "RON" | "EUR";
  quantity: number;
  eurRonRateMicros: number | null;
  amount: number;
  currency: "RON";
  priceVersion: string;
}

export function validQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function convertToRon(unitAmount: number, currency: string, rate: number | null, quantity = 1): number {
  if (!Number.isSafeInteger(unitAmount) || unitAmount < 0 || !validQuantity(quantity)) {
    throw new Error("Invalid source amount or quantity");
  }
  if ((currency !== "RON" && currency !== "EUR") ||
    (currency === "RON" ? rate !== null : !validQuantity(rate))) {
    throw new Error("Invalid currency or exchange rate");
  }
  const sourceAmount = BigInt(unitAmount) * BigInt(quantity);
  const amount = currency === "RON" ? sourceAmount : (sourceAmount * BigInt(rate!) + 500000n) / 1000000n;
  if (sourceAmount > BigInt(Number.MAX_SAFE_INTEGER) || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount exceeds safe integer range");
  }
  return Number(amount);
}

export async function snapshotVersion(snapshot: Omit<PriceSnapshot, "priceVersion">): Promise<string> {
  const canonical = [snapshot.schemaVersion, snapshot.kind, snapshot.entityId, snapshot.childId,
    snapshot.sourceUnitAmount, snapshot.sourceCurrency, snapshot.quantity, snapshot.eurRonRateMicros,
    snapshot.amount, snapshot.currency];
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createPriceSnapshot(
  kind: PriceSnapshot["kind"], entityId: string, childId: string,
  sourceUnitAmount: number, sourceCurrency: string, eurRonRateMicros: number | null, quantity: number,
): Promise<PriceSnapshot> {
  const amount = convertToRon(sourceUnitAmount, sourceCurrency, eurRonRateMicros, quantity);
  const snapshot: Omit<PriceSnapshot, "priceVersion"> = {
    schemaVersion: 1, kind, entityId, childId, sourceUnitAmount,
    sourceCurrency: sourceCurrency as PriceSnapshot["sourceCurrency"], quantity, eurRonRateMicros, amount, currency: "RON",
  };
  return { ...snapshot, priceVersion: await snapshotVersion(snapshot) };
}

export async function readPriceSnapshot(value: unknown): Promise<PriceSnapshot> {
  if (!value || typeof value !== "object") throw new Error("Missing price snapshot");
  const snapshot = value as PriceSnapshot;
  if (snapshot.schemaVersion !== 1 || !["COURSE", "CAMP", "ACTIVITY"].includes(snapshot.kind) ||
    typeof snapshot.entityId !== "string" || !snapshot.entityId || typeof snapshot.childId !== "string" || !snapshot.childId ||
    (snapshot.kind !== "COURSE" && snapshot.quantity !== 1) || snapshot.currency !== "RON" ||
    snapshot.amount !== convertToRon(snapshot.sourceUnitAmount, snapshot.sourceCurrency, snapshot.eurRonRateMicros, snapshot.quantity) ||
    snapshot.priceVersion !== await snapshotVersion(snapshot)) {
    throw new Error("Invalid price snapshot");
  }
  return snapshot;
}
