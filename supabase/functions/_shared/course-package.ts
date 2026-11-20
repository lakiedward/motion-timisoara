import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";
import { validQuantity } from "./price-snapshot.ts";

export interface CoursePackageOffer {
  id: string;
  sessions: number;
  price: number;
  validity: string;
}

export interface CourseChoice {
  quantity: number;
  coursePackage: CoursePackageOffer | null;
}

export interface CourseChoiceRequest {
  coursePackageId?: unknown;
  sessionPackageSize?: unknown;
}

export const PACKAGE_CHANGED = "PACKAGE_CHANGED";
export const SOLD_PACKAGE_VALIDITY = "NONE";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sessionsChoice(quantity: number): CourseChoice {
  return { quantity, coursePackage: null };
}

export function chooseCourseOffer(
  packages: CoursePackageOffer[],
  request: CourseChoiceRequest,
): CourseChoice {
  const { coursePackageId, sessionPackageSize } = request;
  if (coursePackageId !== undefined && (typeof coursePackageId !== "string" || !UUID.test(coursePackageId))) {
    throw enrollmentJson({ error: "Pachetul ales nu este valid." }, 400);
  }
  if (packages.length === 0) {
    if (coursePackageId !== undefined) {
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
      error: "Acest curs se plătește pe pachete. Alege unul dintre pachetele cursului.",
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
  if (chosen.validity !== SOLD_PACKAGE_VALIDITY) {
    throw enrollmentJson({ error: "Pachetul ales nu poate fi cumpărat încă." }, 409);
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
  return { quantity: chosen.sessions, coursePackage: chosen };
}

export async function resolveCourseChoice(
  db: SupabaseClient,
  courseId: string,
  request: CourseChoiceRequest,
): Promise<CourseChoice> {
  const { data, error } = await db
    .from("course_packages")
    .select("id, sessions, price, validity")
    .eq("course_id", courseId);
  if (error) throw enrollmentJson({ error: "Nu am putut citi pachetele cursului. Reîncearcă." }, 500);
  return chooseCourseOffer((data ?? []) as CoursePackageOffer[], request);
}

export function snapshotMatchesChoice(
  snapshot: { quantity: number; packageId?: string },
  choice: CourseChoice,
): boolean {
  return snapshot.quantity === choice.quantity &&
    (snapshot.packageId ?? null) === (choice.coursePackage?.id ?? null);
}
