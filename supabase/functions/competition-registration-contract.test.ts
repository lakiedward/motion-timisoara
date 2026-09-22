import type { EnrollmentServices } from "./_shared/enrollment-pricing.ts";
import { ageAtRegistration, quoteCompetitionRegistration } from "./_shared/competition-registration.ts";
import { createCompetitionRegistrationHandler } from "./create-competition-registration/handler.ts";
import { validateCompetitionRegistrationHandler } from "./validate-competition-registration/handler.ts";
import { withCors } from "./_shared/cors.ts";

type Row = Record<string, unknown>;

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
}

function fixture(priceBani = 12000, allowCash = true) {
  const rows: Record<string, Row[]> = {
    competitions: [
      {
        id: "competition",
        start_at: "2099-06-01T08:00:00Z",
        registration_deadline_at: "2099-05-31T08:00:00Z",
        allow_cash: allowCash,
      },
    ],
    children: [
      {
        id: "child",
        name: "Copil",
        parent_id: "parent",
        birth_date: "2018-09-22",
      },
    ],
    competition_age_categories: [
      {
        id: "category",
        competition_id: "competition",
        route_id: "route",
        age_from: 0,
        age_to: 100,
        price_bani: priceBani,
      },
    ],
    competition_routes: [
      {
        id: "route",
        competition_id: "competition",
        gpx_storage_path: "competition/route.gpx",
      },
    ],
    enrollments: [],
    clubs: [],
    coach_profiles: [],
  };
  const rpcCalls: { name: string; args: Row }[] = [];
  const storagePaths = new Set(["competition/route.gpx"]);
  const db = {
    storage: {
      from(bucket: string) {
        if (bucket !== "competition-routes") throw new Error("wrong bucket");
        return {
          info(path: string) {
            return Promise.resolve(
              storagePaths.has(path)
                ? { data: { name: path }, error: null }
                : { data: null, error: { statusCode: "404" } },
            );
          },
        };
      },
    },
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      return {
        select() {
          return this;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return this;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return this;
        },
        then<T>(resolve: (value: { data: Row[]; error: null }) => T) {
          return Promise.resolve(
            resolve({
              data: rows[table].filter((row) => filters.every((filter) => filter(row))),
              error: null,
            }),
          );
        },
        single() {
          const data = rows[table].filter((row) => filters.every((filter) => filter(row)))[0] ?? null;
          return Promise.resolve({
            data,
            error: data ? null : { message: "not found" },
          });
        },
      };
    },
    rpc(name: string, args: Row) {
      rpcCalls.push({ name, args });
      return Promise.resolve({
        data: {
          enrollmentId: "enrollment",
          enrollmentIds: ["enrollment"],
          createdEnrollmentIds: ["enrollment"],
          prices: [{ childId: "child", amount: priceBani, currency: "RON" }],
          requiresPaymentIntent: args.p_method === "CARD" && priceBani > 0,
        },
        error: null,
      });
    },
  } as unknown as EnrollmentServices["db"];
  const services: EnrollmentServices = {
    db,
    getUser: () => Promise.resolve({ id: "parent" }),
    getUserRole: () => Promise.resolve("PARENT"),
  };
  const request = (body: Row) =>
    new Request("http://local/competition", {
      method: "POST",
      body: JSON.stringify(body),
    });
  const selection = {
    competitionId: "competition",
    selections: [{ childId: "child", categoryId: "category" }],
  };
  return { rows, db, services, rpcCalls, request, selection, storagePaths };
}

Deno.test(
  "age eligibility uses the registration date in Europe/Bucharest",
  () => {
    equal(ageAtRegistration("2018-09-22", new Date("2026-09-21T20:59:59Z")), 7);
    equal(ageAtRegistration("2018-09-22", new Date("2026-09-21T21:00:00Z")), 8);
  },
);

Deno.test(
  "validation returns a server-priced category and V2 quote",
  async () => {
    const context = fixture();
    const response = await withCors(
      validateCompetitionRegistrationHandler(context.services),
    )(context.request(context.selection));
    equal(response.status, 200);
    const body = await response.json();
    equal(body.allowCash, true);
    equal(body.results[0].eligible, true);
    equal(body.results[0].amount, 12000);
    equal(body.results[0].pricingSnapshot.schemaVersion, 2);
    equal(body.results[0].pricingSnapshot.categoryId, "category");
    equal(body.results[0].pricingSnapshot.routeId, "route");
    equal(
      body.results[0].pricingSnapshot.gpxStoragePath,
      "competition/route.gpx",
    );
    equal(
      body.results[0].priceVersion,
      body.results[0].pricingSnapshot.priceVersion,
    );
  },
);

Deno.test(
  "creation submits frozen category quotes to one atomic RPC",
  async () => {
    const context = fixture();
    const quote = await quoteCompetitionRegistration(
      context.db,
      "parent",
      "competition",
      context.selection.selections,
    );
    const response = await withCors(
      createCompetitionRegistrationHandler(context.services),
    )(
      context.request({
        ...context.selection,
        paymentMethod: "CARD",
        priceVersions: { child: quote.results[0].priceVersion },
      }),
    );
    equal(response.status, 200);
    equal((await response.json()).enrollmentIds, ["enrollment"]);
    equal(context.rpcCalls.length, 1);
    equal(context.rpcCalls[0].name, "save_competition_registration");
    equal(context.rpcCalls[0].args.p_parent_id, "parent");
    equal(context.rpcCalls[0].args.p_method, "CARD");
    const saved = (context.rpcCalls[0].args.p_quotes as Row[])[0];
    equal(saved.categoryId, "category");
    equal((saved.snapshot as Row).routeId, "route");
    equal(saved.amount, 12000);
  },
);

Deno.test(
  "free registration bypasses cash restrictions and never asks for Stripe",
  async () => {
    const context = fixture(0, false);
    const quote = await quoteCompetitionRegistration(
      context.db,
      "parent",
      "competition",
      context.selection.selections,
    );
    const response = await withCors(
      createCompetitionRegistrationHandler(context.services),
    )(
      context.request({
        ...context.selection,
        paymentMethod: "CASH",
        priceVersions: { child: quote.results[0].priceVersion },
      }),
    );
    equal(response.status, 200);
    equal((await response.json()).requiresPaymentIntent, false);
    equal(context.rpcCalls[0].args.p_method, "CARD");
  },
);

Deno.test(
  "stale price and disallowed cash fail before registration writes",
  async () => {
    const context = fixture(12000, false);
    const handler = withCors(
      createCompetitionRegistrationHandler(context.services),
    );
    const stale = await handler(
      context.request({
        ...context.selection,
        paymentMethod: "CARD",
        priceVersions: { child: "stale" },
      }),
    );
    equal(stale.status, 409);
    equal((await stale.json()).code, "PRICE_CHANGED");
    const quote = await quoteCompetitionRegistration(
      context.db,
      "parent",
      "competition",
      context.selection.selections,
    );
    const cash = await handler(
      context.request({
        ...context.selection,
        paymentMethod: "CASH",
        priceVersions: { child: quote.results[0].priceVersion },
      }),
    );
    equal(cash.status, 409);
    equal(context.rpcCalls.length, 0);
  },
);

Deno.test(
  "card registration is not saved when its club cannot receive Stripe payments",
  async () => {
    const context = fixture();
    context.rows.competitions[0].club_id = "club";
    context.rows.competitions[0].coach_id = null;
    context.rows.clubs.push({
      id: "club",
      stripe_account_id: null,
      stripe_onboarding_complete: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    });
    const quote = await quoteCompetitionRegistration(
      context.db,
      "parent",
      "competition",
      context.selection.selections,
    );
    const response = await withCors(
      createCompetitionRegistrationHandler(context.services),
    )(
      context.request({
        ...context.selection,
        paymentMethod: "CARD",
        priceVersions: { child: quote.results[0].priceVersion },
      }),
    );
    equal(response.status, 409);
    equal(context.rpcCalls.length, 0);
  },
);

Deno.test(
  "foreign, ineligible and already registered children cannot be submitted",
  async () => {
    const context = fixture();
    context.rows.children[0].parent_id = "other";
    const foreign = (
      await quoteCompetitionRegistration(
        context.db,
        "parent",
        "competition",
        context.selection.selections,
      )
    ).results[0];
    equal(foreign.eligible, false);
    equal(foreign.name, "—");
    context.rows.children[0].parent_id = "parent";
    context.rows.competition_age_categories[0].age_to = 1;
    equal(
      (
        await quoteCompetitionRegistration(
          context.db,
          "parent",
          "competition",
          context.selection.selections,
        )
      ).results[0].eligible,
      false,
    );
    context.rows.competition_age_categories[0].age_to = 100;
    context.rows.enrollments.push({
      id: "existing",
      kind: "COMPETITION",
      entity_id: "competition",
      child_id: "child",
      status: "PENDING",
    });
    const response = await withCors(
      createCompetitionRegistrationHandler(context.services),
    )(
      context.request({
        ...context.selection,
        paymentMethod: "CARD",
        priceVersions: {},
      }),
    );
    equal(response.status, 409);
    equal(context.rpcCalls.length, 0);
  },
);

Deno.test(
  "a replaced GPX changes the quote and an unuploaded route cannot accept registrations",
  async () => {
    const context = fixture();
    const before = await quoteCompetitionRegistration(
      context.db,
      "parent",
      "competition",
      context.selection.selections,
    );
    context.rows.competition_routes[0].gpx_storage_path = "competition/replaced.gpx";
    context.storagePaths.add("competition/replaced.gpx");
    const after = await quoteCompetitionRegistration(
      context.db,
      "parent",
      "competition",
      context.selection.selections,
    );
    equal(
      before.results[0].priceVersion === after.results[0].priceVersion,
      false,
    );
    context.rows.competition_routes[0].gpx_storage_path = null;
    const missing = await quoteCompetitionRegistration(
      context.db,
      "parent",
      "competition",
      context.selection.selections,
    );
    equal(missing.results[0].eligible, false);
  },
);

Deno.test(
  "a route whose GPX object is missing cannot issue an eligible quote",
  async () => {
    const context = fixture();
    context.storagePaths.clear();
    const quote = await quoteCompetitionRegistration(
      context.db,
      "parent",
      "competition",
      context.selection.selections,
    );
    equal(quote.results[0].eligible, false);
  },
);

Deno.test(
  "a closed competition cannot issue a new registration quote",
  async () => {
    const context = fixture();
    let status = 0;
    try {
      await quoteCompetitionRegistration(
        context.db,
        "parent",
        "competition",
        context.selection.selections,
        new Date("2099-05-31T08:00:01Z"),
      );
    } catch (error) {
      if (error instanceof Response) status = error.status;
      else throw error;
    }
    equal(status, 409);
    context.rows.competitions[0].registration_deadline_at = "2099-06-01T08:00:00Z";
    status = 0;
    try {
      await quoteCompetitionRegistration(
        context.db,
        "parent",
        "competition",
        context.selection.selections,
        new Date("2099-06-01T08:00:00Z"),
      );
    } catch (error) {
      if (error instanceof Response) status = error.status;
      else throw error;
    }
    equal(status, 409);
  },
);
