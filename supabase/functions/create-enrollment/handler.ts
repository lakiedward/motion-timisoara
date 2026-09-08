import { getCampChildPrices, validSelection, enrollmentJson, type EnrollmentServices, type CampChildPrice } from "../_shared/enrollment-pricing.ts";

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
    const sessionPackageSize = body.sessionPackageSize ?? 1;

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
      if (paymentMethod === "CARD") {
        if (existing.some((e: any) => e.status === "ACTIVE")) {
          return new Response(
            JSON.stringify({
              error: `Child already enrolled: ${child.name}`,
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
      } else {
        if (existing.length > 0) {
          return new Response(
            JSON.stringify({
              error: `Child already enrolled: ${child.name}`,
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    }
    const newEnrollmentCount = paymentMethod === "CARD"
      ? children.filter((c: any) => {
          const existing = existingByChild.get(c.id) ?? [];
          return !existing.some((e: any) => e.status === "PENDING");
        }).length
      : children.length;
    let entityPrice = 0;
    let campPrices: CampChildPrice[] = [];
    let paymentCurrency = "RON";
    let effectiveSessionPackageSize = sessionPackageSize;

    if (kind === "COURSE") {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("price_per_session, currency, capacity, age_from, age_to, active")
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
      entityPrice = course.price_per_session * effectiveSessionPackageSize;
      paymentCurrency = course.currency;
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
        .select("currency, capacity, allow_cash")
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
      campPrices = await getCampChildPrices(supabaseAdmin, entityId, childIds, camp.currency, existingEnrollments ?? []);
      if (campPrices.some((price) => price.reason)) {
        return enrollmentJson({ error: campPrices.find((price) => price.reason)!.reason }, 409);
      }
      if (campPrices.some((price) => body.priceVersions?.[price.childId] !== price.priceVersion)) {
        return enrollmentJson({ error: "Prețul s-a schimbat. Revino la Detalii și verifică din nou suma.", code: "PRICE_CHANGED" }, 409);
      }
      paymentCurrency = camp.currency;
      effectiveSessionPackageSize = 1;
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
        .select("price, currency, capacity, active")
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
      entityPrice = activity.price;
      paymentCurrency = activity.currency;
      effectiveSessionPackageSize = 1;
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

    const now = new Date().toISOString();
    const savedEnrollments: { id: string }[] = [];
    const prices: { childId: string; amount: number; currency: string }[] = [];

    for (const child of children) {
      const quote = campPrices.find((price) => price.childId === child.id);
      const childPrice = quote?.amount ?? entityPrice;
      const childCurrency = quote?.currency ?? paymentCurrency;
      const existing = existingByChild.get(child.id) ?? [];
      const pendingDraft =
        paymentMethod === "CARD"
          ? existing.find((e: { status: string }) => e.status === "PENDING")
          : undefined;

      let enrollment: { id: string };

      if (pendingDraft) {
        enrollment = { id: pendingDraft.id };

        const paymentPatch: Record<string, unknown> = {
          method: paymentMethod,
          amount: childPrice,
          currency: childCurrency,
          status: "PENDING",
          updated_at: now,
        };
        if (billingDetails) {
          paymentPatch.billing_name = billingDetails.name;
          paymentPatch.billing_email = billingDetails.email;
          paymentPatch.billing_address_line1 = billingDetails.addressLine1;
          paymentPatch.billing_city = billingDetails.city;
          paymentPatch.billing_postal_code = billingDetails.postalCode;
          paymentPatch.billing_country = "RO";
        }

        const { data: payments, error: paymentsError } = await supabaseAdmin
          .from("payments")
          .select("id, status, amount, currency, gateway_txn_id")
          .eq("enrollment_id", enrollment.id);

        if (paymentsError) return enrollmentJson({ error: "Nu am putut verifica plata existentă." }, 500);
        if (payments?.some((p: { status: string }) => p.status === "SUCCEEDED")) {
          return new Response(
            JSON.stringify({ error: `Child already enrolled: ${child.name}` }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }

        const unpaid = payments?.find((p: { status: string }) => p.status === "PENDING");
        const failedRow = payments?.find(
          (p: { status: string }) => p.status === "FAILED" || p.status === "CANCELLED",
        );
        const reusable = unpaid ?? failedRow;
        if (reusable) {
          if (kind === "CAMP" && reusable.gateway_txn_id) {
            if (reusable.amount !== childPrice || reusable.currency !== childCurrency) {
              return enrollmentJson({ error: "Plata s-a schimbat. Verifică din nou înscrierea." }, 409);
            }
          } else {
            let update = supabaseAdmin.from("payments").update(paymentPatch).eq("id", reusable.id).eq("status", reusable.status);
            if (kind === "CAMP") update = update.is("gateway_txn_id", null);
            const saved = await update.select("id").single();
            if (saved.error || !saved.data) return enrollmentJson({ error: "Plata s-a schimbat. Verifică din nou înscrierea." }, 409);
          }
        } else if (!payments?.length) {
          const saved = await supabaseAdmin.from("payments").insert({
            enrollment_id: enrollment.id,
            ...paymentPatch,
            created_at: now,
          });
          if (saved.error) return enrollmentJson({ error: "Nu am putut salva plata." }, 500);
        } else {
          return enrollmentJson({ error: "Plata a fost deja procesată. Verifică în Înscrieri." }, 409);
        }
      } else {
        const { data: created, error: enrollErr } = await supabaseAdmin
          .from("enrollments")
          .insert({
            kind,
            entity_id: entityId,
            child_id: child.id,
            status: "PENDING",
            created_at: now,
            purchased_sessions: 0,
            remaining_sessions: 0,
            sessions_used: 0,
          })
          .select("id")
          .single();

        if (enrollErr || !created) {
          return new Response(
            JSON.stringify({ error: "Failed to create enrollment" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        enrollment = created;

        const paymentData: Record<string, unknown> = {
          enrollment_id: enrollment.id,
          method: paymentMethod,
          amount: childPrice,
          currency: childCurrency,
          status: "PENDING",
          created_at: now,
          updated_at: now,
        };

        if (paymentMethod === "CARD" && billingDetails) {
          paymentData.billing_name = billingDetails.name;
          paymentData.billing_email = billingDetails.email;
          paymentData.billing_address_line1 = billingDetails.addressLine1;
          paymentData.billing_city = billingDetails.city;
          paymentData.billing_postal_code = billingDetails.postalCode;
          paymentData.billing_country = "RO";
        }

        const savedPayment = await supabaseAdmin.from("payments").insert(paymentData);
        if (savedPayment.error) return enrollmentJson({ error: "Nu am putut salva plata." }, 500);
        if (paymentMethod === "CASH") {
          if (kind === "COURSE") {
            await supabaseAdmin.channel("admin:pending-cash-payments").send({
              type: "broadcast",
              event: "pending_cash_payment",
              payload: {
                enrollmentId: enrollment.id,
                sessionCount: effectiveSessionPackageSize,
                courseId: entityId,
              },
            });
          } else if (kind === "ACTIVITY") {
            await supabaseAdmin.channel("admin:pending-activity-payments").send({
              type: "broadcast",
              event: "pending_activity_payment",
              payload: {
                enrollmentId: enrollment.id,
                activityId: entityId,
                childName: child.name,
              },
            });
          }
        }
      }

      savedEnrollments.push(enrollment);
      prices.push({ childId: child.id, amount: childPrice, currency: childCurrency });
    }

    const primaryId = savedEnrollments[0]?.id;
    const enrollmentIds = savedEnrollments.map((e: { id: string }) => e.id);
    return new Response(
      JSON.stringify({
        enrollmentId: primaryId,
        enrollmentIds,
        prices,
        requiresPaymentIntent: paymentMethod === "CARD",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
}
