export interface PriceSnapshot {
  schemaVersion: 1 | 2;
  kind: "COURSE" | "CAMP" | "ACTIVITY" | "COMPETITION";
  entityId: string;
  childId: string | null;
  adultProfileId?: string | null;
  adultBirthDate?: string;
  categoryId?: string;
  routeId?: string;
  gpxStoragePath?: string;
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

export function convertToRon(
  unitAmount: number,
  currency: string,
  rate: number | null,
  quantity = 1,
): number {
  if (
    !Number.isSafeInteger(unitAmount) ||
    unitAmount < 0 ||
    !validQuantity(quantity)
  ) {
    throw new Error("Invalid source amount or quantity");
  }
  if (
    (currency !== "RON" && currency !== "EUR") ||
    (currency === "RON" ? rate !== null : !validQuantity(rate))
  ) {
    throw new Error("Invalid currency or exchange rate");
  }
  const sourceAmount = BigInt(unitAmount) * BigInt(quantity);
  const amount = currency === "RON"
    ? sourceAmount
    : (sourceAmount * BigInt(rate!) + 500000n) / 1000000n;
  if (
    sourceAmount > BigInt(Number.MAX_SAFE_INTEGER) ||
    amount > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error("Amount exceeds safe integer range");
  }
  return Number(amount);
}

function snapshotSubjectId(
  snapshot: Pick<PriceSnapshot, "childId" | "adultProfileId">,
) {
  return snapshot.adultProfileId ?? snapshot.childId;
}

export async function snapshotVersion(
  snapshot: Omit<PriceSnapshot, "priceVersion">,
): Promise<string> {
  const canonical = [
    snapshot.schemaVersion,
    snapshot.kind,
    snapshot.entityId,
    snapshotSubjectId(snapshot),
    ...(snapshot.kind === "COMPETITION" && snapshot.adultProfileId
      ? [snapshot.adultBirthDate]
      : []),
    ...(snapshot.schemaVersion === 2
      ? [snapshot.categoryId, snapshot.routeId, snapshot.gpxStoragePath]
      : []),
    snapshot.sourceUnitAmount,
    snapshot.sourceCurrency,
    snapshot.quantity,
    snapshot.eurRonRateMicros,
    snapshot.amount,
    snapshot.currency,
  ];
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(canonical)),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createPriceSnapshot(
  kind: Exclude<PriceSnapshot["kind"], "COMPETITION">,
  entityId: string,
  childId: string | null,
  sourceUnitAmount: number,
  sourceCurrency: string,
  eurRonRateMicros: number | null,
  quantity: number,
  adultProfileId: string | null = null,
): Promise<PriceSnapshot> {
  const amount = convertToRon(
    sourceUnitAmount,
    sourceCurrency,
    eurRonRateMicros,
    quantity,
  );
  const snapshot: Omit<PriceSnapshot, "priceVersion"> = {
    schemaVersion: 1,
    kind,
    entityId,
    childId: adultProfileId ? null : childId,
    sourceUnitAmount,
    sourceCurrency: sourceCurrency as PriceSnapshot["sourceCurrency"],
    quantity,
    eurRonRateMicros,
    amount,
    currency: "RON",
    ...(adultProfileId ? { adultProfileId } : {}),
  };
  return { ...snapshot, priceVersion: await snapshotVersion(snapshot) };
}

export async function createCompetitionPriceSnapshot(
  competitionId: string,
  subject: string | { adultProfileId: string; adultBirthDate: string },
  categoryId: string,
  routeId: string,
  gpxStoragePath: string,
  priceBani: number,
): Promise<PriceSnapshot> {
  const childId = typeof subject === "string" ? subject : null;
  const adultProfileId = typeof subject === "string"
    ? null
    : subject.adultProfileId;
  const adultBirthDate = typeof subject === "string"
    ? null
    : subject.adultBirthDate;
  if (
    !competitionId ||
    (!childId && !adultProfileId) ||
    (adultProfileId !== null && !validCalendarBirthDate(adultBirthDate)) ||
    !categoryId ||
    !routeId ||
    !gpxStoragePath ||
    !Number.isSafeInteger(priceBani) ||
    priceBani < 0 ||
    priceBani > 99_999_999
  ) {
    throw new Error("Invalid competition price");
  }
  const snapshot: Omit<PriceSnapshot, "priceVersion"> = {
    schemaVersion: 2,
    kind: "COMPETITION",
    entityId: competitionId,
    childId,
    ...(adultProfileId
      ? { adultProfileId, adultBirthDate: adultBirthDate! }
      : {}),
    categoryId,
    routeId,
    gpxStoragePath,
    sourceUnitAmount: priceBani,
    sourceCurrency: "RON",
    quantity: 1,
    eurRonRateMicros: null,
    amount: priceBani,
    currency: "RON",
  };
  return { ...snapshot, priceVersion: await snapshotVersion(snapshot) };
}

export function validCalendarBirthDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const date = new Date(`${value}T00:00:00.000Z`);
  return year > 0 && Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

export async function readPriceSnapshot(
  value: unknown,
): Promise<PriceSnapshot> {
  if (!value || typeof value !== "object") {
    throw new Error("Missing price snapshot");
  }
  const snapshot = value as PriceSnapshot;
  const hasChild = typeof snapshot.childId === "string" &&
    snapshot.childId.length > 0;
  const hasAdult = typeof snapshot.adultProfileId === "string" &&
    snapshot.adultProfileId.length > 0;
  const competition = snapshot.schemaVersion === 2 &&
    snapshot.kind === "COMPETITION";
  const standard = snapshot.schemaVersion === 1 &&
    ["COURSE", "CAMP", "ACTIVITY"].includes(snapshot.kind);
  if (
    (!standard && !competition) ||
    typeof snapshot.entityId !== "string" ||
    !snapshot.entityId ||
    hasChild === hasAdult ||
    (hasAdult && snapshot.kind !== "CAMP" && snapshot.kind !== "COMPETITION") ||
    (competition &&
      ((hasAdult
        ? snapshot.childId !== null ||
          !validCalendarBirthDate(snapshot.adultBirthDate)
        : snapshot.adultBirthDate !== undefined) ||
        typeof snapshot.categoryId !== "string" ||
        !snapshot.categoryId ||
        typeof snapshot.routeId !== "string" ||
        !snapshot.routeId ||
        typeof snapshot.gpxStoragePath !== "string" ||
        !snapshot.gpxStoragePath ||
        snapshot.sourceCurrency !== "RON" ||
        snapshot.eurRonRateMicros !== null ||
        snapshot.amount > 99_999_999)) ||
    (standard &&
      (snapshot.categoryId !== undefined ||
        snapshot.routeId !== undefined ||
        snapshot.gpxStoragePath !== undefined ||
        snapshot.adultBirthDate !== undefined)) ||
    (snapshot.kind !== "COURSE" && snapshot.quantity !== 1) ||
    snapshot.currency !== "RON" ||
    snapshot.amount !==
      convertToRon(
        snapshot.sourceUnitAmount,
        snapshot.sourceCurrency,
        snapshot.eurRonRateMicros,
        snapshot.quantity,
      ) ||
    snapshot.priceVersion !== (await snapshotVersion(snapshot))
  ) {
    throw new Error("Invalid price snapshot");
  }
  return snapshot;
}
