import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";
import { type PriceSnapshot, validPackageMonth, validQuantity, validValidityDays } from "./price-snapshot.ts";

export interface CoursePackageOffer {
  id: string;
  sessions: number;
  price: number;
  validity: string;
  validity_days?: number | null;
}

export interface CourseChoice {
  quantity: number;
  coursePackage: CoursePackageOffer | null;
  month: string | null;
}

export interface CourseChoiceRequest {
  coursePackageId?: unknown;
  sessionPackageSize?: unknown;
  packageMonth?: unknown;
}

export const PACKAGE_CHANGED = "PACKAGE_CHANGED";
export const MONTH_CHANGED = "MONTH_CHANGED";
const SOLD_VALIDITIES = ["NONE", "CALENDAR_MONTH", "DAYS"];

export function bucharestMonth(now: Date, offset = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const index = year * 12 + month - 1 + offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

export function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return `${MONTH_NAMES[index - 1] ?? month} ${year}`;
}

export function bucharestToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function packageMonths(now: Date): string[] {
  return [bucharestMonth(now, 0), bucharestMonth(now, 1)];
}

export function monthEnded(month: string, now: Date): boolean {
  return month < bucharestMonth(now, 0);
}

export function snapshotMonthEnded(snapshot: Pick<PriceSnapshot, "validity" | "validMonth">, now: Date): boolean {
  return snapshot.validity === "CALENDAR_MONTH" && typeof snapshot.validMonth === "string" &&
    monthEnded(snapshot.validMonth, now);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sessionsChoice(quantity: number): CourseChoice {
  return { quantity, coursePackage: null, month: null };
}

export function chooseCourseOffer(
  packages: CoursePackageOffer[],
  request: CourseChoiceRequest,
  now: Date = new Date(),
): CourseChoice {
  const { coursePackageId, sessionPackageSize, packageMonth } = request;
  if (coursePackageId !== undefined && (typeof coursePackageId !== "string" || !UUID.test(coursePackageId))) {
    throw enrollmentJson({ error: "Pachetul ales nu este valid." }, 400);
  }
  if (packageMonth !== undefined && !validPackageMonth(packageMonth)) {
    throw enrollmentJson({ error: "Luna aleasă nu este validă." }, 400);
  }
  if (packages.length === 0) {
    if (coursePackageId !== undefined || packageMonth !== undefined) {
      throw enrollmentJson({
        error: "Cursul nu mai are pachete. Revino la Detalii și alege din nou.",
        code: PACKAGE_CHANGED,
      }, 409);
    }
    const quantity = sessionPackageSize === undefined ? 1 : sessionPackageSize;
    if (!validQuantity(quantity)) throw enrollmentJson({ error: "Numărul de ședințe nu este valid." }, 400);
    return sessionsChoice(quantity);
  }
  if (coursePackageId === undefined) {
    throw enrollmentJson({
      error: "Acest curs se plătește acum pe pachete. Reîncarcă pagina și alege unul dintre pachetele cursului.",
      code: PACKAGE_CHANGED,
    }, 409);
  }
  const chosen = packages.find((item) => item.id.toLowerCase() === (coursePackageId as string).toLowerCase());
  if (!chosen) {
    throw enrollmentJson({
      error: "Pachetul ales nu mai este disponibil. Revino la Detalii și alege din nou.",
      code: PACKAGE_CHANGED,
    }, 409);
  }
  if (!SOLD_VALIDITIES.includes(chosen.validity)) {
    throw enrollmentJson({ error: "Pachetul ales nu poate fi cumpărat încă." }, 409);
  }
  let month: string | null = null;
  if (chosen.validity === "CALENDAR_MONTH") {
    if (packageMonth === undefined) {
      throw enrollmentJson({ error: "Alege luna pentru care cumperi pachetul lunar." }, 400);
    }
    if (!packageMonths(now).includes(packageMonth as string)) {
      throw enrollmentJson({
        error: "Pachetul lunar se cumpără doar pentru luna aceasta sau luna următoare. Alege din nou luna.",
        code: MONTH_CHANGED,
      }, 409);
    }
    month = packageMonth as string;
  } else if (packageMonth !== undefined) {
    throw enrollmentJson({
      error: chosen.validity === "DAYS"
        ? "Acest pachet expiră după un număr de zile; nu are o lună de ales."
        : "Acest pachet nu expiră; nu are o lună de ales.",
    }, 400);
  }
  if (chosen.validity === "DAYS" ? !validValidityDays(chosen.validity_days) : chosen.validity_days != null) {
    throw enrollmentJson({ error: "Pachetul nu este valid. Contactează clubul." }, 409);
  }
  if (
    !validQuantity(chosen.sessions) || chosen.sessions > 100 ||
    !Number.isSafeInteger(chosen.price) || chosen.price <= 0
  ) {
    throw enrollmentJson({ error: "Pachetul nu este valid. Contactează clubul." }, 409);
  }
  if (sessionPackageSize !== undefined && sessionPackageSize !== chosen.sessions) {
    throw enrollmentJson({ error: "Numărul de ședințe nu corespunde pachetului ales." }, 400);
  }
  return { quantity: chosen.sessions, coursePackage: chosen, month };
}

export async function resolveCourseChoice(
  db: SupabaseClient,
  courseId: string,
  request: CourseChoiceRequest,
): Promise<CourseChoice> {
  const { data, error } = await db
    .from("course_packages")
    .select("id, sessions, price, validity, validity_days")
    .eq("course_id", courseId);
  if (error) throw enrollmentJson({ error: "Nu am putut citi pachetele cursului. Reîncearcă." }, 500);
  return chooseCourseOffer((data ?? []) as CoursePackageOffer[], request);
}

export function snapshotMatchesChoice(
  snapshot: { quantity: number; packageId?: string; validMonth?: string; validDays?: number },
  choice: CourseChoice,
): boolean {
  return snapshot.quantity === choice.quantity &&
    (snapshot.packageId ?? null) === (choice.coursePackage?.id ?? null) &&
    (snapshot.validMonth ?? null) === choice.month &&
    (snapshot.validDays ?? null) === (choice.coursePackage?.validity === "DAYS"
      ? choice.coursePackage.validity_days ?? null
      : null);
}
