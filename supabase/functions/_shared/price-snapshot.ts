export interface PriceSnapshot {
  schemaVersion: 1 | 2 | 3;
  kind: "COURSE" | "CAMP" | "ACTIVITY" | "COMPETITION";
  entityId: string;
  childId: string | null;
  adultProfileId?: string | null;
  adultBirthDate?: string;
  categoryId?: string;
  routeId?: string;
  gpxStoragePath?: string | null;
  sourceUnitAmount?: number;
  packageId?: string;
  validity?: PackageValidity;
  validMonth?: string;
  sourcePackageAmount?: number;
  sourceCurrency: "RON" | "EUR";
  quantity: number;
  eurRonRateMicros: number | null;
  amount: number;
  currency: "RON";
  priceVersion: string;
}

export type PackageValidity = "NONE" | "CALENDAR_MONTH";

const PACKAGE_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function validPackageMonth(value: unknown): value is string {
  return typeof value === "string" && PACKAGE_MONTH.test(value);
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
  const canonical = snapshot.schemaVersion === 3
    ? [
      snapshot.schemaVersion,
      snapshot.kind,
      snapshot.entityId,
      snapshot.childId,
      snapshot.packageId,
      snapshot.validity,
      ...(snapshot.validity === "CALENDAR_MONTH" ? [snapshot.validMonth] : []),
      snapshot.sourcePackageAmount,
      snapshot.sourceCurrency,
      snapshot.quantity,
      snapshot.eurRonRateMicros,
      snapshot.amount,
      snapshot.currency,
    ]
    : [
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

export const PACKAGE_SNAPSHOT_KEYS = [
  "schemaVersion",
  "kind",
  "entityId",
  "childId",
  "packageId",
  "validity",
  "sourcePackageAmount",
  "sourceCurrency",
  "quantity",
  "eurRonRateMicros",
  "amount",
  "currency",
  "priceVersion",
];

const MAX_PACKAGE_SESSIONS = 100;
const MAX_PACKAGE_PRICE = 10_000_000;

export async function createCoursePackageSnapshot(
  courseId: string,
  childId: string,
  coursePackage: { id: string; sessions: number; price: number; validity: string },
  sourceCurrency: string,
  eurRonRateMicros: number | null,
  validMonth: string | null = null,
): Promise<PriceSnapshot> {
  const monthly = coursePackage.validity === "CALENDAR_MONTH";
  if (
    !courseId || !childId || !coursePackage.id ||
    (coursePackage.validity !== "NONE" && !monthly) ||
    (monthly ? !validPackageMonth(validMonth) : validMonth !== null) ||
    !validQuantity(coursePackage.sessions) || coursePackage.sessions > MAX_PACKAGE_SESSIONS ||
    !validQuantity(coursePackage.price) || coursePackage.price > MAX_PACKAGE_PRICE
  ) {
    throw new Error("Invalid course package");
  }
  const snapshot: Omit<PriceSnapshot, "priceVersion"> = {
    schemaVersion: 3,
    kind: "COURSE",
    entityId: courseId,
    childId,
    packageId: coursePackage.id,
    validity: coursePackage.validity as PackageValidity,
    ...(monthly ? { validMonth: validMonth! } : {}),
    sourcePackageAmount: coursePackage.price,
    sourceCurrency: sourceCurrency as PriceSnapshot["sourceCurrency"],
    quantity: coursePackage.sessions,
    eurRonRateMicros,
    amount: convertToRon(coursePackage.price, sourceCurrency, eurRonRateMicros, 1),
    currency: "RON",
  };
  return { ...snapshot, priceVersion: await snapshotVersion(snapshot) };
}

async function readCoursePackageSnapshot(snapshot: PriceSnapshot): Promise<PriceSnapshot> {
  const keys = Object.keys(snapshot);
  const monthly = snapshot.validity === "CALENDAR_MONTH";
  const expected = monthly ? [...PACKAGE_SNAPSHOT_KEYS, "validMonth"] : PACKAGE_SNAPSHOT_KEYS;
  if (
    keys.length !== expected.length ||
    !expected.every((key) => keys.includes(key)) ||
    (monthly && !validPackageMonth(snapshot.validMonth)) ||
    snapshot.kind !== "COURSE" ||
    typeof snapshot.entityId !== "string" || !snapshot.entityId ||
    typeof snapshot.childId !== "string" || !snapshot.childId ||
    typeof snapshot.packageId !== "string" || !snapshot.packageId ||
    (snapshot.validity !== "NONE" && !monthly) ||
    !validQuantity(snapshot.quantity) || snapshot.quantity > MAX_PACKAGE_SESSIONS ||
    !validQuantity(snapshot.sourcePackageAmount) || snapshot.sourcePackageAmount > MAX_PACKAGE_PRICE ||
    snapshot.currency !== "RON" ||
    snapshot.amount !== convertToRon(snapshot.sourcePackageAmount, snapshot.sourceCurrency, snapshot.eurRonRateMicros, 1) ||
    snapshot.priceVersion !== (await snapshotVersion(snapshot))
  ) {
    throw new Error("Invalid price snapshot");
  }
  return snapshot;
}

export async function createCompetitionPriceSnapshot(
  competitionId: string,
  subject: string | { adultProfileId: string; adultBirthDate: string },
  categoryId: string,
  routeId: string,
  gpxStoragePath: string | null,
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
    (gpxStoragePath !== null && !gpxStoragePath) ||
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
  if (snapshot.schemaVersion === 3) return await readCoursePackageSnapshot(snapshot);
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
        (snapshot.gpxStoragePath !== null &&
          (typeof snapshot.gpxStoragePath !== "string" ||
            !snapshot.gpxStoragePath)) ||
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
        snapshot.sourceUnitAmount!,
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
