import { test, expect, type Page, type TestInfo } from "@playwright/test";

const backendOrigin = "http://127.0.0.1:54329";
const competitionId = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const routeId = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const categoryId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const parentId = "11111111-1111-1111-1111-111111111111";
const childId = "22222222-2222-2222-2222-222222222222";
const coachId = "33333333-3333-3333-3333-333333333333";
const registrationId = "44444444-4444-4444-4444-444444444444";
const alternateRegistrationId = "55555555-5555-5555-5555-555555555555";
const podiumId = "66666666-6666-6666-6666-666666666666";
const gpxPath = `${competitionId}/routes/${routeId}/ffffffff-ffff-ffff-ffff-ffffffffffff.gpx`;
const gpx =
  '<?xml version="1.0"?><gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Parc</name><trkseg><trkpt lat="45.7500" lon="21.2300"/><trkpt lat="45.7510" lon="21.2310"/></trkseg></trk></gpx>';
const tile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9CqG8AAAAASUVORK5CYII=",
  "base64",
);

type Scenario = "public" | "free" | "podium" | "form";

async function simulate(page: Page, scenario: Scenario) {
  await page.clock.setFixedTime(new Date("2026-09-22T12:00:00Z"));
  const errors: string[] = [];
  const unexpectedApi: string[] = [];
  const submissions: Record<string, unknown>[] = [];
  let created = false;
  let podiumRegistrationId = registrationId;
  const userId =
    scenario === "podium" || scenario === "form" ? coachId : parentId;
  const role =
    scenario === "podium" || scenario === "form" ? "COACH" : "PARENT";
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push(`${message.text()} ${message.location().url}`);
  });
  page.on("requestfailed", (request) => {
    if (
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      request.url().includes("basemaps.cartocdn.com")
    )
      return;
    errors.push(`${request.failure()?.errorText} ${request.url()}`);
  });
  await page.addInitScript(
    ({ origin, id }) => {
      const tokenPart = (value: unknown) =>
        btoa(JSON.stringify(value))
          .replace(/=/g, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_");
      const expiry = Math.floor(Date.now() / 1000) + 86400;
      const user = {
        id,
        email: "parent@example.invalid",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      };
      const session = {
        access_token: `${tokenPart({ alg: "HS256", typ: "JWT" })}.${tokenPart({ sub: id, exp: expiry, role: "authenticated" })}.simulation`,
        refresh_token: "simulation-only",
        token_type: "bearer",
        expires_at: expiry,
        expires_in: 86400,
        user,
      };
      localStorage.setItem(
        `sb-${new URL(origin).hostname.split(".")[0]}-auth-token`,
        JSON.stringify(session),
      );
    },
    { origin: backendOrigin, id: userId },
  );
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    if (request.method() === "OPTIONS") return respond(null);
    if (url.origin === "https://js.stripe.com")
      return route.fulfill({
        contentType: "application/javascript",
        body: 'window.Stripe = function () { throw new Error("Real Stripe is forbidden in this simulation") }',
      });
    if (url.hostname.endsWith("basemaps.cartocdn.com"))
      return route.fulfill({ body: tile, contentType: "image/png" });
    if (path.includes("/storage/v1/object/public/competition-routes/")) {
      return route.fulfill({
        body: gpx,
        contentType: "application/gpx+xml",
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    if (
      url.origin === new URL(test.info().project.use.baseURL as string).origin
    )
      return route.continue();
    if (path === "/auth/v1/user")
      return respond({
        id: userId,
        email: "parent@example.invalid",
        aud: "authenticated",
        user_metadata: {},
      });
    if (path === "/rest/v1/rpc/my_profile")
      return respond([
        {
          id: userId,
          email: "parent@example.invalid",
          name: "Utilizator Simulat",
          role,
          phone: "0000000000",
          avatar_url: null,
        },
      ]);
    if (path === "/rest/v1/competitions") {
      const competition = {
        id: competitionId,
        slug: "concurs-simulat",
        title: "Concurs Simulat",
        description: "Traseu pentru copii.",
        hero_photo_storage_path: null,
        club_id: null,
        coach_id:
          scenario === "podium"
            ? parentId
            : scenario === "form"
              ? coachId
              : null,
        club: null,
        coach: null,
        start_at:
          scenario === "podium"
            ? "2026-09-21T08:00:00Z"
            : "2026-09-30T08:00:00Z",
        end_at:
          scenario === "podium"
            ? "2026-09-21T16:00:00Z"
            : "2026-09-30T16:00:00Z",
        registration_deadline_at:
          scenario === "podium"
            ? "2026-09-20T08:00:00Z"
            : "2026-09-29T08:00:00Z",
        location_text: "Parcul Rozelor, Timișoara",
        allow_cash: true,
        created_at: "2026-09-20T08:00:00Z",
      };
      return respond(
        request.headers().accept?.includes("vnd.pgrst.object")
          ? competition
          : [competition],
      );
    }
    if (path === "/rest/v1/competition_routes")
      return respond([
        {
          id: routeId,
          competition_id: competitionId,
          name: "Traseul Parcului",
          description: "Tură scurtă în parc.",
          gpx_storage_path: gpxPath,
          display_order: 0,
        },
      ]);
    if (path === "/rest/v1/competition_age_categories")
      return respond([
        {
          id: categoryId,
          competition_id: competitionId,
          route_id: routeId,
          name: "8–10 ani",
          age_from: 8,
          age_to: 10,
          price_bani: 0,
          display_order: 0,
        },
      ]);
    if (path === "/rest/v1/competition_coaches") return respond([]);
    if (
      path === "/rest/v1/locations" ||
      path === "/rest/v1/rpc/get_competition_cash_payments"
    )
      return respond([]);
    if (path === "/rest/v1/competition_podium_publications")
      return respond([
        {
          id: "publication-simulated",
          competition_id: competitionId,
          category_id: categoryId,
          published_at: "2026-09-21T18:00:00Z",
          published_by: parentId,
        },
      ]);
    if (path === "/rest/v1/competition_podium_results") {
      if (request.method() === "PATCH") {
        podiumRegistrationId = (
          request.postDataJSON() as { registration_id: string }
        ).registration_id;
        submissions.push(request.postDataJSON());
      }
      const result = {
        id: podiumId,
        competition_id: competitionId,
        category_id: categoryId,
        registration_id: podiumRegistrationId,
        place: 1,
        updated_at: "2026-09-22T12:00:00Z",
        updated_by: coachId,
        created_at: "2026-09-21T18:00:00Z",
      };
      return respond(
        request.headers().accept?.includes("vnd.pgrst.object")
          ? result
          : [result],
      );
    }
    if (path === "/rest/v1/rpc/get_competition_podium_candidates")
      return respond([
        {
          registration_id: registrationId,
          child_name: "Copil Ana",
          age_at_registration: 9,
        },
        {
          registration_id: alternateRegistrationId,
          child_name: "Copil Bogdan",
          age_at_registration: 9,
        },
      ]);
    if (path === "/rest/v1/children")
      return respond([
        {
          id: childId,
          name: "Copil Simulat",
          parent_id: parentId,
          birth_date: "2017-04-12",
        },
      ]);
    if (path === "/functions/v1/validate-competition-registration")
      return respond({
        results: [
          {
            childId,
            categoryId,
            routeId,
            name: "Copil Simulat",
            eligible: true,
            amount: 0,
            currency: "RON",
            priceVersion: "simulation-version",
          },
        ],
        allowCash: true,
      });
    if (path === "/functions/v1/create-competition-registration") {
      submissions.push(request.postDataJSON());
      created = true;
      return respond({
        enrollmentId: "enrollment-simulated",
        enrollmentIds: ["enrollment-simulated"],
        requiresPaymentIntent: false,
        prices: [{ childId, amount: 0, currency: "RON" }],
      });
    }
    if (path === "/rest/v1/enrollments")
      return respond(
        created
          ? [
              {
                id: "enrollment-simulated",
                kind: "COMPETITION",
                entity_id: competitionId,
                status: "ACTIVE",
                created_at: "2026-09-22T12:00:00Z",
                child_id: childId,
                child: { id: childId, name: "Copil Simulat" },
                competition_registration: {
                  category_name_snapshot: "8–10 ani",
                  route_name_snapshot: "Traseul Parcului",
                },
                payments: [
                  {
                    amount: 0,
                    currency: "RON",
                    status: "SUCCEEDED",
                    method: "CARD",
                    paid_at: "2026-09-22T12:00:00Z",
                    pricing_snapshot: null,
                  },
                ],
              },
            ]
          : [],
      );
    if (path.startsWith("/rest/v1/")) return respond([]);
    unexpectedApi.push(`${request.method()} ${url.origin}${path}`);
    return route.abort("blockedbyclient");
  });
  return { errors, unexpectedApi, submissions, scenario };
}

async function capture(page: Page, info: TestInfo, name: string) {
  const widths = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  const path = info.outputPath(`SIMULATED-${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await info.attach(
    `SIMULATED ${name}; ${page.viewportSize()?.width}x${page.viewportSize()?.height}; ${page.url()}`,
    { path, contentType: "image/png" },
  );
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
]) {
  test(`SIMULATED public competition ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    const state = await simulate(page, "public");
    await page.goto("/concursuri/concurs-simulat");
    await expect(
      page.getByRole("heading", { name: "Concurs Simulat" }),
    ).toBeVisible();
    await expect(page.getByText("Parcul Rozelor, Timișoara")).toBeVisible();
    await expect(page.getByText("Traseul Parcului").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Descarcă GPX" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Harta traseului Traseul Parcului" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Înscriere la concurs" }),
    ).toBeVisible();
    await capture(page, info, "public-competition");
    expect(state.errors).toEqual([]);
    expect(state.unexpectedApi).toEqual([]);
  });
}

test("SIMULATED free competition registration on native viewport", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await simulate(page, "free");
  await page.goto("/account/competitions/concurs-simulat/register");
  await expect(
    page.getByRole("heading", { name: "Înscriere la Concurs Simulat" }),
  ).toBeVisible();
  await page.getByLabel("Copil Simulat").selectOption(categoryId);
  await expect(page.getByText("Preț verificat: Gratuit")).toBeVisible();
  await page
    .getByRole("checkbox", { name: /Confirm categoriile și suma finală/ })
    .check();
  await capture(page, info, "free-registration");
  await page
    .getByRole("button", { name: "Confirmă înscrierea gratuită" })
    .click();
  await expect(page).toHaveURL(/\/account\/enrollments$/);
  await expect(page.getByText("Concurs Simulat")).toBeVisible();
  expect(state.submissions).toMatchObject([
    {
      competitionId,
      selections: [{ childId, categoryId }],
      paymentMethod: "CARD",
      priceVersions: { [childId]: "simulation-version" },
    },
  ]);
  expect(state.errors).toEqual([]);
  expect(state.unexpectedApi).toEqual([]);
});

test("SIMULATED associated coach corrects published podium on native viewport", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await simulate(page, "podium");
  await page.goto(`/coach/competitions/${competitionId}/results`);
  await expect(
    page.getByRole("heading", { name: "Podium · Concurs Simulat" }),
  ).toBeVisible();
  await expect(
    page.getByText("Publicat. Corecțiile făcute aici sunt vizibile imediat."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publică podiumul categoriei" }),
  ).toHaveCount(0);
  await page.getByLabel("Locul 1").selectOption(alternateRegistrationId);
  await expect(page.getByLabel("Locul 1")).toHaveValue(alternateRegistrationId);
  await capture(page, info, "published-podium-coach-correction");
  expect(state.submissions).toMatchObject([
    { registration_id: alternateRegistrationId },
  ]);
  expect(state.errors).toEqual([]);
  expect(state.unexpectedApi).toEqual([]);
});

test("SIMULATED coach configures competition on native viewport", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await simulate(page, "form");
  await page.goto(`/coach/competitions/${competitionId}/edit`);
  await expect(
    page.getByRole("heading", { name: "Editează concursul" }),
  ).toBeVisible();
  await expect(page.getByLabel("Data de început")).toHaveValue("2026-09-30");
  await expect(page.getByLabel("Ora închiderii înscrierilor")).toHaveValue(
    "11:00",
  );
  await expect(
    page.getByRole("heading", { name: "Trasee și categorii" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Antrenorii asociați" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Completează podiumul după concurs" }),
  ).toBeVisible();
  await capture(page, info, "coach-competition-form");
  expect(state.errors).toEqual([]);
  expect(state.unexpectedApi).toEqual([]);
});
