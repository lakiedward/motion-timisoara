// Edge Function: validate-enrollment
// Per-child eligibility check used by the checkout wizard (step 1) before any
// enrollment row is written. Mirrors the rules enforced by create-enrollment so
// the user sees the failure up front instead of a 409 at the end of the flow.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin, getUser, getUserRole } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";

interface ValidateRequest {
  kind: "COURSE" | "CAMP" | "ACTIVITY";
  entityId: string;
  childIds: string[];
}

type Severity = "error" | "warning";

interface ChildResult {
  childId: string;
  name: string;
  eligible: boolean;
  severity?: Severity;
  reason?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Age in whole years at today's date. */
function ageOf(birthDate: string): number {
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const user = await getUser(req);
    const role = await getUserRole(user.id);
    if (role !== "PARENT") {
      return json({ error: "Only parents can enroll children" }, 403);
    }

    const { kind, entityId, childIds }: ValidateRequest = await req.json();
    if (!kind || !entityId || !childIds?.length) {
      return json({ error: "kind, entityId and childIds are required" }, 400);
    }

    const { data: children, error: childErr } = await supabaseAdmin
      .from("children")
      .select("id, name, birth_date, parent_id")
      .in("id", childIds);
    if (childErr) return json({ error: "Failed to load children" }, 500);

    // Load the entity once — age limits (courses only) and capacity.
    let ageFrom: number | null = null;
    let ageTo: number | null = null;
    let capacity: number | null = null;
    // create-enrollment gates cash on `allow_cash` for camps only; courses and
    // activities accept cash unconditionally (they broadcast a pending-cash event).
    let allowCash = kind !== "CAMP";

    if (kind === "COURSE") {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("age_from, age_to, capacity, active")
        .eq("id", entityId)
        .single();
      if (!course) return json({ error: "Course not found" }, 404);
      if (!course.active) return json({ error: "Course is not active" }, 400);
      ageFrom = course.age_from;
      ageTo = course.age_to;
      capacity = course.capacity;
    } else if (kind === "CAMP") {
      const { data: camp } = await supabaseAdmin
        .from("camps")
        .select("capacity, allow_cash")
        .eq("id", entityId)
        .single();
      if (!camp) return json({ error: "Camp not found" }, 404);
      capacity = camp.capacity;
      allowCash = camp.allow_cash;
    } else {
      const { data: activity } = await supabaseAdmin
        .from("activities")
        .select("capacity, active")
        .eq("id", entityId)
        .single();
      if (!activity) return json({ error: "Activity not found" }, 404);
      if (!activity.active) return json({ error: "Activity is not active" }, 400);
      capacity = activity.capacity;
    }

    // Existing enrollments for these children on this entity.
    const { data: existing } = await supabaseAdmin
      .from("enrollments")
      .select("child_id, status")
      .eq("kind", kind)
      .eq("entity_id", entityId)
      .in("child_id", childIds)
      .in("status", ["PENDING", "ACTIVE"]);

    const byChild = new Map<string, string[]>();
    for (const e of existing ?? []) {
      byChild.set(e.child_id, [...(byChild.get(e.child_id) ?? []), e.status]);
    }

    const results: ChildResult[] = childIds.map((childId) => {
      const child = children?.find((c) => c.id === childId);
      if (!child) {
        return { childId, name: "—", eligible: false, severity: "error", reason: "Copilul nu a fost găsit" };
      }
      if (child.parent_id !== user.id) {
        return { childId, name: child.name, eligible: false, severity: "error", reason: "Copilul nu îți aparține" };
      }

      const age = ageOf(child.birth_date);
      if (ageFrom !== null && age < ageFrom) {
        return {
          childId,
          name: child.name,
          eligible: false,
          severity: "error",
          reason: `Vârsta minimă este ${ageFrom} ani (${child.name} are ${age})`,
        };
      }
      if (ageTo !== null && age > ageTo) {
        return {
          childId,
          name: child.name,
          eligible: false,
          severity: "error",
          reason: `Vârsta maximă este ${ageTo} ani (${child.name} are ${age})`,
        };
      }

      const statuses = byChild.get(childId) ?? [];
      if (statuses.includes("ACTIVE")) {
        return {
          childId,
          name: child.name,
          eligible: false,
          severity: "error",
          reason: "Deja înscris",
        };
      }
      if (statuses.includes("PENDING")) {
        // create-enrollment tolerates this for CARD but rejects it for CASH.
        return {
          childId,
          name: child.name,
          eligible: true,
          severity: "warning",
          reason: "Există o înscriere neplătită; plata cash nu este disponibilă",
        };
      }

      return { childId, name: child.name, eligible: true };
    });

    // Capacity is a property of the whole request, not of one child.
    let available: number | null = null;
    if (capacity !== null) {
      const { count } = await supabaseAdmin
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("kind", kind)
        .eq("entity_id", entityId)
        .in("status", ["PENDING", "ACTIVE"]);
      available = capacity - (count ?? 0);
    }

    const requested = results.filter((r) => r.eligible).length;

    return json({
      results,
      capacity: { available, requested, sufficient: available === null || available >= requested },
      allowCash,
    });
  }),
);
