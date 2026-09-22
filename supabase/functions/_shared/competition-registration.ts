import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enrollmentJson } from "./enrollment-pricing.ts";
import { createCompetitionPriceSnapshot, type PriceSnapshot } from "./price-snapshot.ts";

export interface CompetitionSelection {
  childId: string;
  categoryId: string;
}

export interface CompetitionQuote {
  childId: string;
  categoryId: string;
  routeId: string;
  name: string;
  eligible: boolean;
  reason?: string;
  amount?: number;
  currency?: "RON";
  priceVersion?: string;
  pricingSnapshot?: PriceSnapshot;
}

export function validCompetitionSelection(
  value: unknown,
): value is CompetitionSelection[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    return false;
  }
  if (
    value.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        typeof item.childId !== "string" ||
        !item.childId ||
        typeof item.categoryId !== "string" ||
        !item.categoryId,
    )
  ) {
    return false;
  }
  return new Set(value.map((item) => item.childId)).size === value.length;
}

function localDateParts(now: Date): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (name: string) => Number(parts.find((part) => part.type === name)?.value);
  return [value("year"), value("month"), value("day")];
}

export function ageAtRegistration(birthDate: string, now: Date): number {
  const [year, month, day] = localDateParts(now);
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  if (
    ![year, month, day, birthYear, birthMonth, birthDay].every(Number.isInteger)
  ) {
    throw new Error("Invalid child birth date");
  }
  return (
    year -
    birthYear -
    (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0)
  );
}

export async function quoteCompetitionRegistration(
  db: SupabaseClient,
  parentId: string,
  competitionId: string,
  selections: CompetitionSelection[],
  now = new Date(),
): Promise<{ results: CompetitionQuote[]; allowCash: boolean }> {
  if (
    typeof competitionId !== "string" ||
    !competitionId ||
    !validCompetitionSelection(selections)
  ) {
    throw enrollmentJson(
      { error: "Alege un concurs, un copil și o categorie." },
      400,
    );
  }
  const { data: competition, error: competitionError } = await db
    .from("competitions")
    .select("id,start_at,registration_deadline_at,allow_cash")
    .eq("id", competitionId)
    .single();
  if (competitionError || !competition) {
    throw enrollmentJson({ error: "Concursul nu a fost găsit." }, 404);
  }
  const deadline = Date.parse(competition.registration_deadline_at ?? "");
  const start = Date.parse(competition.start_at ?? "");
  if (
    !Number.isFinite(deadline) ||
    !Number.isFinite(start) ||
    deadline > start ||
    now.getTime() > deadline ||
    now.getTime() >= start
  ) {
    throw enrollmentJson(
      { error: "Înscrierile la acest concurs sunt închise." },
      409,
    );
  }
  const childIds = selections.map((item) => item.childId);
  const categoryIds = [...new Set(selections.map((item) => item.categoryId))];
  const [childrenResult, categoriesResult, existingResult] = await Promise.all([
    db
      .from("children")
      .select("id,name,parent_id,birth_date")
      .in("id", childIds),
    db
      .from("competition_age_categories")
      .select("id,competition_id,route_id,age_from,age_to,price_bani")
      .eq("competition_id", competitionId)
      .in("id", categoryIds),
    db
      .from("enrollments")
      .select("id,child_id,status")
      .eq("kind", "COMPETITION")
      .eq("entity_id", competitionId)
      .in("child_id", childIds)
      .in("status", ["PENDING", "ACTIVE"]),
  ]);
  if (childrenResult.error || categoriesResult.error || existingResult.error) {
    throw enrollmentJson(
      {
        error: "Nu am putut verifica participanții și categoriile. Reîncearcă.",
      },
      503,
    );
  }
  const children = new Map(
    (childrenResult.data ?? []).map((child) => [child.id, child]),
  );
  const categories = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const routeIds = [
    ...new Set(
      (categoriesResult.data ?? []).map((category) => category.route_id),
    ),
  ];
  const routesResult = routeIds.length
    ? await db
      .from("competition_routes")
      .select("id,competition_id,gpx_storage_path")
      .eq("competition_id", competitionId)
      .in("id", routeIds)
    : { data: [], error: null };
  if (routesResult.error) {
    throw enrollmentJson(
      { error: "Nu am putut verifica traseele concursului." },
      503,
    );
  }
  const routes = new Map(
    (routesResult.data ?? []).map((route) => [route.id, route]),
  );
  const routePaths = [
    ...new Set(
      (routesResult.data ?? [])
        .map((route) => route.gpx_storage_path)
        .filter(
          (path): path is string => typeof path === "string" && path.length > 0,
        ),
    ),
  ];
  const existingRoutePaths = new Set<string>();
  await Promise.all(
    routePaths.map(async (path) => {
      const { data, error } = await db.storage
        .from("competition-routes")
        .info(path);
      if (!error && data) existingRoutePaths.add(path);
    }),
  );
  const existing = new Set(
    (existingResult.data ?? []).map((enrollment) => enrollment.child_id),
  );
  const results = await Promise.all(
    selections.map(
      async ({ childId, categoryId }): Promise<CompetitionQuote> => {
        const child = children.get(childId);
        const category = categories.get(categoryId);
        const base = {
          childId,
          categoryId,
          routeId: category?.route_id ?? "",
          name: child?.parent_id === parentId ? child.name : "—",
        };
        const reject = (reason: string): CompetitionQuote => ({
          ...base,
          eligible: false,
          reason,
        });
        if (!child || child.parent_id !== parentId) {
          return reject("Copilul nu îți aparține.");
        }
        if (
          !category ||
          category.competition_id !== competitionId ||
          !category.route_id
        ) {
          return reject("Categoria nu aparține acestui concurs.");
        }
        const route = routes.get(category.route_id);
        if (
          !route ||
          route.competition_id !== competitionId ||
          !route.gpx_storage_path ||
          !existingRoutePaths.has(route.gpx_storage_path)
        ) {
          return reject("Traseul categoriei nu are încă un fișier GPX.");
        }
        if (existing.has(childId)) {
          return reject("Există deja o înscriere. Verifică în Înscrieri.");
        }
        const age = ageAtRegistration(child.birth_date, now);
        if (age < category.age_from || age > category.age_to) {
          return reject(
            `Categoria acceptă vârste de la ${category.age_from} la ${category.age_to} ani.`,
          );
        }
        let snapshot: PriceSnapshot;
        try {
          snapshot = await createCompetitionPriceSnapshot(
            competitionId,
            childId,
            categoryId,
            category.route_id,
            route.gpx_storage_path,
            category.price_bani,
          );
        } catch {
          throw enrollmentJson(
            {
              error: "Prețul categoriei nu este valid. Contactează organizatorul.",
            },
            409,
          );
        }
        return {
          ...base,
          eligible: true,
          amount: snapshot.amount,
          currency: "RON",
          priceVersion: snapshot.priceVersion,
          pricingSnapshot: snapshot,
        };
      },
    ),
  );
  return { results, allowCash: competition.allow_cash === true };
}
