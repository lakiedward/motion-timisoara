import { getEnrollmentChildPrices, validSelection, enrollmentJson, type EnrollmentServices, type EnrollmentOffer } from "../_shared/enrollment-pricing.ts";
import { completedEnrollmentPrices, notifyCashEnrollments, saveEnrollmentBatch } from "./persistence.ts";
import { validQuantity } from "../_shared/price-snapshot.ts";

interface EnrollmentRequest {
  kind: "COURSE" | "CAMP" | "ACTIVITY";
  entityId: string;
  childIds: string[];
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
    const { kind, entityId, childIds, paymentMethod, billingDetails } = body;
    const sessionPackageSize = body.sessionPackageSize === undefined ? 1 : body.sessionPackageSize;
    if (!validQuantity(sessionPackageSize) || (kind !== "COURSE" && sessionPackageSize !== 1)) {
      return enrollmentJson({ error: "Numărul de ședințe nu este valid." }, 400);
    }

    if (!validSelection(kind, entityId, childIds) || !["CARD", "CASH"].includes(paymentMethod)) {
      return new Response(
        JSON.stringify({ error: "At least one child must be specified" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const { data: children, error: childErr } = await supabaseAdmin
      .from("children")
      .select("id, name, parent_id, birth_date")
      .in("id", childIds);
    if (childErr || !children || children.length !== childIds.length) {
      return new Response(
        JSON.stringify({ error: "Children not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
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
    const { data: existingEnrollments, error: existingError } = await supabaseAdmin
      .from("enrollments")
      .select("id, child_id, status")
      .eq("kind", kind)
      .eq("entity_id", entityId)
      .in("child_id", childIds)
      .in("status", ["PENDING", "ACTIVE"]);

    if (existingError) return enrollmentJson({ error: "Nu am putut verifica înscrierile existente." }, 500);
    const existingByChild = new Map<string, typeof existingEnrollments>();
    for (const e of existingEnrollments ?? []) {
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
    const newEnrollmentCount = paymentMethod === "CARD"
      ? children.filter((c: any) => {
          const existing = existingByChild.get(c.id) ?? [];
          return existing.length === 0;
        }).length
      : children.length;
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
      ? await completedEnrollmentPrices(supabaseAdmin, kind, entityId, existingEnrollments ?? [], sessionPackageSize)
      : [];
    const completedChildIds = new Set(completed.map((price) => price.childId));
    const childPrices = [
      ...await getEnrollmentChildPrices(supabaseAdmin, kind, entityId, childIds.filter((id) => !completedChildIds.has(id)), offer,
        (existingEnrollments ?? []).filter((row) => !completedChildIds.has(row.child_id)), sessionPackageSize),
      ...completed,
    ];
    if (childPrices.some((price) => price.reason)) {
      return enrollmentJson({ error: childPrices.find((price) => price.reason)!.reason }, 409);
    }
    if (childPrices.some((price) => body.priceVersions?.[price.childId] !== price.priceVersion)) {
      return enrollmentJson({ error: "Prețul s-a schimbat. Revino la Detalii și verifică din nou suma.", code: "PRICE_CHANGED" }, 409);
    }

    const batch = await saveEnrollmentBatch(supabaseAdmin, {
      parentId: user.id, kind, entityId, paymentMethod, quotes: childPrices, billingDetails,
    });
    if (paymentMethod === "CASH") {
      await notifyCashEnrollments(supabaseAdmin, batch, { kind, entityId, sessionPackageSize, children });
    }
    const { createdEnrollmentIds: _createdEnrollmentIds, ...response } = batch;
    return enrollmentJson(response);
  };
}
