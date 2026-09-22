import { getEnrollmentAdultPrice, getEnrollmentChildPrices, quoteSubjectKey, validSelection, enrollmentJson, type EnrollmentServices, type EnrollmentOffer, type ExistingEnrollment } from "../_shared/enrollment-pricing.ts";
import { completedEnrollmentPrices, notifyCashEnrollments, saveEnrollmentBatch } from "./persistence.ts";
import { validQuantity } from "../_shared/price-snapshot.ts";

interface EnrollmentRequest {
  kind: "COURSE" | "CAMP" | "ACTIVITY";
  entityId: string;
  childIds: string[];
  includeSelf?: boolean;
  paymentMethod: "CARD" | "CASH";
  sessionPackageSize?: number;
  priceVersions?: Record<string, string>;
  billingDetails?: {
    name: string;
    email: string;
    addressLine1: string;
    city: string;
    postalCode: string;
  };
}

function ageOf(birthDate: string): number {
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

async function loadExisting(
  db: EnrollmentServices["db"],
  kind: string,
  entityId: string,
  childIds: string[],
  parentId: string,
  includeSelf: boolean,
): Promise<ExistingEnrollment[]> {
  const rows: ExistingEnrollment[] = [];
  if (childIds.length) {
    const { data, error } = await db
      .from("enrollments")
      .select("id, child_id, adult_profile_id, status")
      .eq("kind", kind)
      .eq("entity_id", entityId)
      .in("child_id", childIds)
      .in("status", ["PENDING", "ACTIVE"]);
    if (error) throw enrollmentJson({ error: "Nu am putut verifica înscrierile existente." }, 500);
    rows.push(...(data ?? []));
  }
  if (includeSelf) {
    const { data, error } = await db
      .from("enrollments")
      .select("id, child_id, adult_profile_id, status")
      .eq("kind", kind)
      .eq("entity_id", entityId)
      .eq("adult_profile_id", parentId)
      .in("status", ["PENDING", "ACTIVE"]);
    if (error) throw enrollmentJson({ error: "Nu am putut verifica înscrierile existente." }, 500);
    rows.push(...(data ?? []));
  }
  return rows;
}

export function createEnrollmentHandler({ db: supabaseAdmin, getUser, getUserRole }: EnrollmentServices) {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
      });
    }

    const user = await getUser(req);
    const role = await getUserRole(user.id);
    if (role !== "PARENT") {
      return new Response(
        JSON.stringify({ error: "Only parents can enroll children" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const body: EnrollmentRequest = await req.json();
    const { kind, entityId, paymentMethod, billingDetails } = body;
    const childIds = Array.isArray(body.childIds) ? body.childIds : [];
    const includeSelf = body.includeSelf === true;
    const sessionPackageSize = body.sessionPackageSize === undefined ? 1 : body.sessionPackageSize;
    if (!validQuantity(sessionPackageSize) || (kind !== "COURSE" && sessionPackageSize !== 1)) {
      return enrollmentJson({ error: "Numărul de ședințe nu este valid." }, 400);
    }

    if (!validSelection(kind, entityId, childIds, includeSelf) || !["CARD", "CASH"].includes(paymentMethod)) {
      return new Response(
        JSON.stringify({ error: "Selectează cel puțin un participant." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    let children: { id: string; name: string; parent_id: string; birth_date: string }[] = [];
    if (childIds.length) {
      const { data, error: childErr } = await supabaseAdmin
        .from("children")
        .select("id, name, parent_id, birth_date")
        .in("id", childIds);
      if (childErr || !data || data.length !== childIds.length) {
        return new Response(
          JSON.stringify({ error: "Children not found" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      children = data;
    }
    for (const child of children) {
      if (child.parent_id !== user.id) {
        return new Response(
          JSON.stringify({
            error: "Copilul nu îți aparține",
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
    }
    let existingEnrollments: ExistingEnrollment[];
    try {
      existingEnrollments = await loadExisting(supabaseAdmin, kind, entityId, childIds, user.id, includeSelf);
    } catch (response) {
      if (response instanceof Response) return response;
      throw response;
    }
    const existingByChild = new Map<string, ExistingEnrollment[]>();
    for (const e of existingEnrollments) {
      if (!e.child_id) continue;
      const list = existingByChild.get(e.child_id) ?? [];
      list.push(e);
      existingByChild.set(e.child_id, list);
    }
    for (const child of children) {
      const existing = existingByChild.get(child.id) ?? [];
      if (paymentMethod === "CASH" && existing.length > 0) {
        return enrollmentJson({ error: `Child already enrolled: ${child.name}` }, 409);
      }
    }
    const existingAdult = existingEnrollments.filter((row) => row.adult_profile_id === user.id);
    if (includeSelf && paymentMethod === "CASH" && existingAdult.length > 0) {
      return enrollmentJson({ error: "Ești deja înscris la această tabără." }, 409);
    }
    const newChildCount = paymentMethod === "CARD"
      ? children.filter((c) => (existingByChild.get(c.id) ?? []).length === 0).length
      : children.length;
    const newAdultCount = includeSelf && (paymentMethod !== "CARD" || existingAdult.length === 0) ? 1 : 0;
    const newEnrollmentCount = newChildCount + newAdultCount;
    let offer: EnrollmentOffer;

    if (kind === "COURSE") {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("price_per_session, currency, eur_ron_rate_micros, capacity, age_from, age_to, active")
        .eq("id", entityId)
        .single();
      if (!course) {
        return new Response(
          JSON.stringify({ error: "Course not found" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      if (!course.active) {
        return new Response(
          JSON.stringify({ error: "Course is not active" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      for (const child of children) {
        const age = ageOf(child.birth_date);
        if (course.age_from != null && age < course.age_from) {
          return new Response(
            JSON.stringify({
              error: `Vârsta minimă este ${course.age_from} ani (${child.name} are ${age})`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (course.age_to != null && age > course.age_to) {
          return new Response(
            JSON.stringify({
              error: `Vârsta maximă este ${course.age_to} ani (${child.name} are ${age})`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      offer = course;
      if (newEnrollmentCount > 0 && course.capacity != null) {
        const { count, error: capacityError } = await supabaseAdmin
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("kind", "COURSE")
          .eq("entity_id", entityId)
          .in("status", ["PENDING", "ACTIVE"]);
        if (capacityError) return enrollmentJson({ error: "Nu am putut verifica locurile disponibile." }, 500);
        const available = course.capacity - (count ?? 0);
        if (available < newEnrollmentCount) {
          return new Response(
            JSON.stringify({
              error: `Not enough spots. Requested: ${newEnrollmentCount}, Available: ${available}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    } else if (kind === "CAMP") {
      const { data: camp } = await supabaseAdmin
        .from("camps")
        .select("currency, eur_ron_rate_micros, capacity, allow_cash")
        .eq("id", entityId)
        .single();
      if (!camp) {
        return new Response(
          JSON.stringify({ error: "Camp not found" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      if (paymentMethod === "CASH" && !camp.allow_cash) {
        return new Response(
          JSON.stringify({
            error: "Cash payments not allowed for this camp",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      offer = camp;
      if (newEnrollmentCount > 0 && camp.capacity != null) {
        const { count, error: capacityError } = await supabaseAdmin
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("kind", "CAMP")
          .eq("entity_id", entityId)
          .in("status", ["PENDING", "ACTIVE"]);
        if (capacityError) return enrollmentJson({ error: "Nu am putut verifica locurile disponibile." }, 500);
        const available = camp.capacity - (count ?? 0);
        if (available < newEnrollmentCount) {
          return new Response(
            JSON.stringify({
              error: `Not enough spots. Requested: ${newEnrollmentCount}, Available: ${available}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    } else {
      const { data: activity } = await supabaseAdmin
        .from("activities")
        .select("price, currency, eur_ron_rate_micros, capacity, active")
        .eq("id", entityId)
        .single();
      if (!activity) {
        return new Response(
          JSON.stringify({ error: "Activity not found" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      if (!activity.active) {
        return new Response(
          JSON.stringify({ error: "Activity is not active" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      offer = activity;
      if (newEnrollmentCount > 0 && activity.capacity != null) {
        const { count, error: capacityError } = await supabaseAdmin
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .eq("kind", "ACTIVITY")
          .eq("entity_id", entityId)
          .in("status", ["PENDING", "ACTIVE"]);
        if (capacityError) return enrollmentJson({ error: "Nu am putut verifica locurile disponibile." }, 500);
        const available = activity.capacity - (count ?? 0);
        if (available < newEnrollmentCount) {
          return new Response(
            JSON.stringify({
              error: `Not enough spots. Requested: ${newEnrollmentCount}, Available: ${available}`,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    }

    const completed = paymentMethod === "CARD"
      ? await completedEnrollmentPrices(supabaseAdmin, kind, entityId, existingEnrollments, sessionPackageSize)
      : [];
    const completedChildIds = new Set(completed.map((price) => price.childId).filter((id): id is string => !!id));
    const quotes = [
      ...await getEnrollmentChildPrices(supabaseAdmin, kind, entityId, childIds.filter((id) => !completedChildIds.has(id)), offer,
        existingEnrollments.filter((row) => row.child_id && !completedChildIds.has(row.child_id)), sessionPackageSize),
      ...completed.filter((price) => price.childId),
    ];
    if (includeSelf) {
      const completedAdult = completed.find((price) => price.adultProfileId === user.id);
      quotes.push(completedAdult ?? await getEnrollmentAdultPrice(supabaseAdmin, entityId, user.id, existingAdult));
    }
    if (quotes.some((price) => price.reason)) {
      return enrollmentJson({ error: quotes.find((price) => price.reason)!.reason }, 409);
    }
    if (quotes.some((price) => body.priceVersions?.[quoteSubjectKey(price)] !== price.priceVersion)) {
      return enrollmentJson({ error: "Prețul s-a schimbat. Revino la Detalii și verifică din nou suma.", code: "PRICE_CHANGED" }, 409);
    }

    const batch = await saveEnrollmentBatch(supabaseAdmin, {
      parentId: user.id, kind, entityId, paymentMethod, quotes, billingDetails,
    });
    if (paymentMethod === "CASH" && batch.prices.some((price) => price.amount > 0)) {
      await notifyCashEnrollments(supabaseAdmin, batch, { kind, entityId, sessionPackageSize, children });
    }
    const { createdEnrollmentIds: _createdEnrollmentIds, ...response } = batch;
    return enrollmentJson(response);
  };
}
