import { checkoutTrialEnd } from "../_shared/subscription-billing.ts";
import {
  assert,
  checkoutFixture,
  clubId,
  coachId,
  day,
  expectFailure,
  now,
  post,
  site,
  subscriptionId,
} from "./test-fixtures.ts";

Deno.test("checkout refuses native and unknown origins before reading the session", async () => {
  for (const origin of [null, "capacitor://localhost", "https://localhost"]) {
    const { handler, calls } = checkoutFixture();
    await expectFailure(
      await handler(post({ planCode: "COACH" }, origin)),
      403,
      "ORIGIN_NOT_ALLOWED",
    );
    assert(calls.length === 0);
  }
});

Deno.test("checkout requires a signed-in coach or club with a live role", async () => {
  await expectFailure(
    await checkoutFixture().handler(post({ planCode: "COACH" }, site, null)),
    401,
    "UNAUTHORIZED",
  );
  await expectFailure(
    await checkoutFixture().handler(
      post({ planCode: "COACH" }, site, "Bearer other"),
    ),
    401,
    "UNAUTHORIZED",
  );
  for (const role of ["PARENT", "ADMIN", null]) {
    const { handler, calls } = checkoutFixture({ role });
    await expectFailure(
      await handler(post({ planCode: "COACH" })),
      403,
      "ROLE_NOT_ALLOWED",
    );
    assert(!calls.some((call) => call.startsWith("subscription")));
  }
  await expectFailure(
    await checkoutFixture({ role: "CLUB", club: false }).handler(
      post({ planCode: "CLUB" }),
    ),
    404,
    "SUBSCRIBER_NOT_FOUND",
  );
  await expectFailure(
    await checkoutFixture({ subscription: null }).handler(
      post({ planCode: "COACH" }),
    ),
    409,
    "SUBSCRIPTION_MISSING",
  );
  const get = await checkoutFixture().handler(
    new Request("https://local.test/fn"),
  );
  assert(get.status === 405);
});

Deno.test("checkout validates the plan against the caller's subscriber type", async () => {
  for (
    const body of [
      {},
      { planCode: "coach" },
      { planCode: "COACH", priceId: "price_x" },
      { planCode: 1 },
      [],
    ]
  ) {
    await expectFailure(
      await checkoutFixture().handler(post(body)),
      400,
      "INVALID_REQUEST",
    );
  }
  await expectFailure(
    await checkoutFixture().handler(post({ planCode: "MISSING" })),
    404,
    "PLAN_NOT_FOUND",
  );
  await expectFailure(
    await checkoutFixture().handler(post({ planCode: "OLD" })),
    404,
    "PLAN_NOT_FOUND",
  );
  await expectFailure(
    await checkoutFixture().handler(post({ planCode: "DRAFT" })),
    503,
    "PLAN_NOT_READY",
  );
  await expectFailure(
    await checkoutFixture().handler(post({ planCode: "CLUB_PRO" })),
    403,
    "PLAN_NOT_ALLOWED",
  );
  await expectFailure(
    await checkoutFixture({ role: "CLUB" }).handler(
      post({ planCode: "COACH" }),
    ),
    403,
    "PLAN_NOT_ALLOWED",
  );
});

Deno.test("a new subscriber gets one Stripe customer and a subscription Checkout", async () => {
  const { handler, calls, sessions, customers } = checkoutFixture();
  const response = await handler(
    post({ planCode: " COACH " }, "http://localhost:3017"),
  );
  const body = await response.json();
  assert(
    response.status === 200 &&
      body.url === "https://checkout.stripe.com/c/pay/cs_test",
  );
  assert(
    customers.length === 1 &&
      customers[0].key === `subscription-customer-${subscriptionId}`,
  );
  assert(customers[0].email === "user@local.test");
  assert(
    customers[0].metadata.subscriber_type === "COACH" &&
      customers[0].metadata.subscriber_id === coachId,
  );
  assert(
    calls.includes("save-customer") &&
      calls.includes(`subscription:COACH:${coachId}`),
  );
  const { params, key } = sessions[0];
  assert(key.startsWith("subscription-checkout-"));
  assert(
    params.mode === "subscription" && params.locale === "ro" &&
      params.currency === "ron",
  );
  assert(
    params.customer === "cus_new" &&
      params.client_reference_id === subscriptionId,
  );
  assert(
    params.line_items.length === 1 &&
      params.line_items[0].price === "price_coach",
  );
  assert(params.billing_address_collection === "required");
  assert(params.consent_collection.terms_of_service === "required");
  assert(
    params.custom_text.terms_of_service_acceptance.message.includes(
      "http://localhost:3017/termeni",
    ),
  );
  assert(
    params.metadata.terms_version === "1.2" &&
      params.subscription_data.metadata.plan_code === "COACH",
  );
  assert(
    params.success_url.startsWith(
      "http://localhost:3017/coach/abonament?abonament=reusit",
    ),
  );
  assert(params.success_url.endsWith("session_id={CHECKOUT_SESSION_ID}"));
  assert(
    params.cancel_url ===
      "http://localhost:3017/coach/abonament?abonament=anulat",
  );
  assert(
    params.subscription_data.trial_end === Math.floor((now + 20 * day) / 1000),
  );
  assert(!calls.includes("count"));
});

Deno.test("an existing Stripe customer is reused and a parallel winner is respected", async () => {
  const existing = checkoutFixture({
    subscription: { stripe_customer_id: "cus_existing" },
  });
  assert((await existing.handler(post({ planCode: "COACH" }))).status === 200);
  assert(
    existing.customers.length === 0 &&
      !existing.calls.includes("save-customer"),
  );
  assert(existing.sessions[0].params.customer === "cus_existing");

  const race = checkoutFixture({ savedCustomer: "cus_winner" });
  assert((await race.handler(post({ planCode: "COACH" }))).status === 200);
  assert(race.sessions[0].params.customer === "cus_winner");

  const again = checkoutFixture();
  await again.handler(post({ planCode: "COACH" }));
  await again.handler(post({ planCode: "COACH" }));
  assert(again.sessions[0].key === again.sessions[1].key);
});

Deno.test("an open Checkout for the same plan is reused and any other is expired first", async () => {
  const metadata = {
    subscription_id: subscriptionId,
    plan_code: "CLUB",
    terms_version: "1.2",
  };
  const successUrl =
    `${site}/club/abonament?abonament=reusit&session_id={CHECKOUT_SESSION_ID}`;
  const reuse = checkoutFixture({
    role: "CLUB",
    subscription: { stripe_customer_id: "cus_club" },
    openSessions: [{
      id: "cs_open",
      url: "https://checkout.stripe.com/c/pay/cs_open",
      mode: "subscription",
      successUrl,
      metadata,
    }],
  });
  const reused = await reuse.handler(post({ planCode: "CLUB" }));
  assert(
    reused.status === 200 && (await reused.json()).url.endsWith("cs_open"),
  );
  assert(
    reuse.sessions.length === 0 &&
      !reuse.calls.some((call) => call.startsWith("expire")),
  );

  const replace = checkoutFixture({
    role: "CLUB",
    subscription: { stripe_customer_id: "cus_club" },
    openSessions: [
      {
        id: "cs_other_plan",
        url: "https://checkout.stripe.com/x",
        mode: "subscription",
        successUrl,
        metadata: { ...metadata, plan_code: "CLUB_PRO" },
      },
      {
        id: "cs_old_terms",
        url: "https://checkout.stripe.com/y",
        mode: "subscription",
        successUrl,
        metadata: { ...metadata, terms_version: "1.1" },
      },
      {
        id: "cs_enrollment",
        url: "https://checkout.stripe.com/z",
        mode: "payment",
        successUrl: null,
        metadata: {},
      },
    ],
  });
  assert((await replace.handler(post({ planCode: "CLUB" }))).status === 200);
  assert(
    replace.calls.includes("expire:cs_other_plan") &&
      replace.calls.includes("expire:cs_old_terms"),
  );
  assert(
    !replace.calls.includes("expire:cs_enrollment") &&
      replace.sessions.length === 1,
  );
});

Deno.test("a club cannot pick a plan below its current coach count", async () => {
  const below = checkoutFixture({ role: "CLUB", coachCount: 5 });
  const body = await expectFailure(
    await below.handler(post({ planCode: "CLUB_START" })),
    409,
    "PLAN_BELOW_COACH_COUNT",
  );
  assert(
    body.coachCount === 5 && body.coachLimit === 3 &&
      body.coachesToRemove === 2,
  );
  assert(below.sessions.length === 0);

  const atLimit = checkoutFixture({ role: "CLUB", coachCount: 3 });
  assert(
    (await atLimit.handler(post({ planCode: "CLUB_START" }))).status === 200,
  );
  assert(
    atLimit.sessions[0].params.success_url.startsWith(
      `${site}/club/abonament?`,
    ),
  );
  assert(
    atLimit.customers[0].name === "Club Test" &&
      atLimit.customers[0].email === "club@local.test",
  );
  assert(atLimit.customers[0].metadata.subscriber_id === clubId);

  const pro = checkoutFixture({ role: "CLUB", coachCount: 40 });
  assert((await pro.handler(post({ planCode: "CLUB_PRO" }))).status === 200);
  assert(!pro.calls.includes("count"));
});

Deno.test("only subscribers without a live Stripe subscription can start Checkout", async () => {
  for (const status of ["active", "past_due", "canceled", "trialing"]) {
    await expectFailure(
      await checkoutFixture({
        subscription: { status, stripe_subscription_id: "sub_1" },
      }).handler(
        post({ planCode: "COACH" }),
      ),
      409,
      "ALREADY_SUBSCRIBED",
    );
  }
  const expired = checkoutFixture({
    subscription: {
      status: "expired",
      stripe_customer_id: "cus_old",
      stripe_subscription_id: "sub_old",
    },
  });
  assert((await expired.handler(post({ planCode: "COACH" }))).status === 200);
  assert(expired.sessions[0].params.customer === "cus_old");
  assert(expired.sessions[0].params.subscription_data.trial_end === undefined);
});

Deno.test("Checkout keeps the remaining trial only when at least 48 hours are left", async () => {
  const settings = { launch_at: "2026-11-06T00:00:00Z", launch_trial_days: 90 };
  const short = checkoutTrialEnd(
    {
      status: "trialing",
      trial_end: new Date(now + 47 * 3_600_000).toISOString(),
    },
    settings,
    now,
  );
  assert("trialEnd" in short && short.trialEnd === null);
  const edge = checkoutTrialEnd(
    {
      status: "trialing",
      trial_end: new Date(now + 48 * 3_600_000).toISOString(),
    },
    settings,
    now,
  );
  assert("trialEnd" in edge && edge.trialEnd === now + 48 * 3_600_000);
  const promo = checkoutTrialEnd(
    { status: "trialing", trial_end: null },
    settings,
    now,
  );
  assert(
    "trialEnd" in promo &&
      promo.trialEnd === Date.parse("2026-11-06T00:00:00Z") + 90 * day,
  );
  const pending = checkoutTrialEnd({ status: "trialing", trial_end: null }, {
    launch_at: null,
    launch_trial_days: 90,
  }, now);
  assert("error" in pending && pending.error === "LAUNCH_PENDING");
  const expired = checkoutTrialEnd({ status: "expired", trial_end: null }, {
    launch_at: null,
    launch_trial_days: 90,
  }, now);
  assert("trialEnd" in expired && expired.trialEnd === null);

  await expectFailure(
    await checkoutFixture({
      subscription: { trial_end: null },
      settings: { launch_at: null, launch_trial_days: 90 },
    }).handler(post({ planCode: "COACH" })),
    409,
    "LAUNCH_PENDING",
  );
  const charged = checkoutFixture({
    subscription: { trial_end: new Date(now + day).toISOString() },
  });
  assert((await charged.handler(post({ planCode: "COACH" }))).status === 200);
  assert(charged.sessions[0].params.subscription_data.trial_end === undefined);
});

Deno.test("Stripe and database failures do not leak details", async () => {
  const stripeDown = checkoutFixture({
    failCheckout: Response.json({ code: "STRIPE_ERROR" }, { status: 503 }),
  });
  assert(
    (await stripeDown.handler(post({ planCode: "COACH" }))).status === 503,
  );
  const crash = checkoutFixture({ failCheckout: new Error("secret detail") });
  const response = await crash.handler(post({ planCode: "COACH" }));
  const body = await response.json();
  assert(
    response.status === 500 && body.code === "SERVER_ERROR" &&
      !JSON.stringify(body).includes("secret"),
  );
});
