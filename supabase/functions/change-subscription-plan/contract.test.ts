import type { SubscriptionRecord } from "../_shared/subscription-billing.ts";
import {
  type ChangePlan,
  type ChangePlanDependencies,
  changePlanHandler,
  type DowngradeParams,
  type LocalPlanPatch,
  type StripeSubscriptionSnapshot,
  type UpgradeParams,
} from "./contract.ts";
import {
  assert,
  clubId,
  clubOwnerId,
  coachId,
  expectFailure,
  post,
  subscriptionId,
} from "../create-subscription-checkout/test-fixtures.ts";

const periodStart = Date.parse("2026-11-02T10:00:00Z") / 1000;
const periodEnd = Date.parse("2026-12-02T10:00:00Z") / 1000;

const plans: ChangePlan[] = [
  {
    code: "CLUB_START",
    subscriber_type: "CLUB",
    price_bani: 19900,
    coach_limit: 3,
    stripe_price_id: "price_start",
    active: true,
  },
  {
    code: "CLUB",
    subscriber_type: "CLUB",
    price_bani: 34900,
    coach_limit: 10,
    stripe_price_id: "price_club",
    active: true,
  },
  {
    code: "CLUB_PRO",
    subscriber_type: "CLUB",
    price_bani: 59900,
    coach_limit: null,
    stripe_price_id: "price_pro",
    active: true,
  },
  {
    code: "CLUB_DRAFT",
    subscriber_type: "CLUB",
    price_bani: 99900,
    coach_limit: null,
    stripe_price_id: null,
    active: true,
  },
];

type Options = {
  role?: string;
  subscription?: Partial<SubscriptionRecord>;
  stripe?: Partial<StripeSubscriptionSnapshot>;
  coachCount?: number;
  failUpgrade?: Response;
};

function fixture(options: Options = {}) {
  const calls: string[] = [];
  const upgrades: UpgradeParams[] = [];
  const downgrades: DowngradeParams[] = [];
  const saved: LocalPlanPatch[] = [];
  const role = options.role ?? "CLUB";
  const dependencies: ChangePlanDependencies = {
    getCaller: (token) =>
      Promise.resolve(
        token === "user-jwt"
          ? {
            id: role === "CLUB" ? clubOwnerId : coachId,
            email: "club@local.test",
            role,
          }
          : null,
      ),
    findOwnedClub: () =>
      Promise.resolve({ id: clubId, email: "club@local.test", name: "Club" }),
    findSubscription: (subscriber) =>
      Promise.resolve({
        id: subscriptionId,
        subscriber_type: subscriber.type,
        plan_code: "CLUB",
        status: "active",
        trial_end: null,
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_1",
        ...options.subscription,
      } as SubscriptionRecord),
    findClubPlans: () => Promise.resolve(plans),
    countClubCoaches: (id) => {
      assert(id === clubId);
      calls.push("count");
      return Promise.resolve(options.coachCount ?? 2);
    },
    retrieveSubscription: (id) => {
      calls.push(`retrieve:${id}`);
      return Promise.resolve({
        id,
        status: "active",
        cancelAtPeriodEnd: false,
        itemId: "si_1",
        priceId: "price_club",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEnd: null,
        scheduleId: null,
        metadata: { subscription_id: subscriptionId, plan_code: "CLUB" },
        ...options.stripe,
      });
    },
    releaseSchedule: (id) => {
      calls.push(`release:${id}`);
      return Promise.resolve();
    },
    upgradeSubscription: (params) => {
      if (options.failUpgrade) return Promise.reject(options.failUpgrade);
      upgrades.push(params);
      return Promise.resolve();
    },
    scheduleDowngrade: (params) => {
      downgrades.push(params);
      return Promise.resolve();
    },
    saveLocalPlan: (rowId, patch) => {
      assert(rowId === subscriptionId);
      saved.push(patch);
      return Promise.resolve();
    },
  };
  return {
    handler: changePlanHandler(dependencies),
    calls,
    upgrades,
    downgrades,
    saved,
  };
}

Deno.test("plan change refuses native origins, coaches and bad bodies", async () => {
  await expectFailure(
    await fixture().handler(
      post({ planCode: "CLUB_PRO" }, "capacitor://localhost"),
    ),
    403,
    "ORIGIN_NOT_ALLOWED",
  );
  await expectFailure(
    await fixture({ role: "COACH" }).handler(post({ planCode: "COACH" })),
    403,
    "PLAN_CHANGE_CLUB_ONLY",
  );
  await expectFailure(
    await fixture({ role: "PARENT" }).handler(post({ planCode: "CLUB" })),
    403,
    "ROLE_NOT_ALLOWED",
  );
  await expectFailure(
    await fixture().handler(post({ planCode: "CLUB", extra: 1 })),
    400,
    "INVALID_REQUEST",
  );
});

Deno.test("plan change needs a live Stripe subscription; checkout covers the rest", async () => {
  for (
    const subscription of [
      { stripe_subscription_id: null },
      { status: "expired" },
    ]
  ) {
    const { handler, calls } = fixture({ subscription });
    await expectFailure(
      await handler(post({ planCode: "CLUB_PRO" })),
      409,
      "NO_BILLING_ACCOUNT",
    );
    assert(calls.length === 0);
  }
  await expectFailure(
    await fixture({ stripe: { status: "past_due" } }).handler(
      post({ planCode: "CLUB_PRO" }),
    ),
    409,
    "SUBSCRIPTION_PAST_DUE",
  );
  await expectFailure(
    await fixture({ stripe: { cancelAtPeriodEnd: true } }).handler(
      post({ planCode: "CLUB_PRO" }),
    ),
    409,
    "SUBSCRIPTION_CANCELED",
  );
  await expectFailure(
    await fixture({ stripe: { status: "canceled" } }).handler(
      post({ planCode: "CLUB_PRO" }),
    ),
    409,
    "NO_BILLING_ACCOUNT",
  );
});

Deno.test("unknown, coach and unpriced plans are refused", async () => {
  await expectFailure(
    await fixture().handler(post({ planCode: "COACH" })),
    404,
    "PLAN_NOT_FOUND",
  );
  await expectFailure(
    await fixture().handler(post({ planCode: "CLUB_DRAFT" })),
    503,
    "PLAN_NOT_READY",
  );
});

Deno.test("upgrade is immediate, charges the prorated difference and clears a scheduled downgrade", async () => {
  const { handler, upgrades, saved, calls } = fixture({
    stripe: { scheduleId: "sub_sched_1" },
  });
  const response = await handler(post({ planCode: "CLUB_PRO" }));
  assert(response.status === 200);
  const body = await response.json();
  assert(body.result === "upgraded" && body.planCode === "CLUB_PRO");
  assert(body.effectiveAt === null);
  assert(calls.includes("release:sub_sched_1"));
  assert(!calls.includes("count"), "unlimited plan needs no coach count");
  assert(upgrades.length === 1);
  assert(upgrades[0].itemId === "si_1" && upgrades[0].priceId === "price_pro");
  assert(
    JSON.stringify(saved) ===
      JSON.stringify([{ plan_code: "CLUB_PRO", scheduled_plan_code: null }]),
  );
});

Deno.test("a declined card on upgrade keeps the old plan and says so", async () => {
  const declined = Response.json(
    { code: "PAYMENT_FAILED", error: "Plata diferenței nu a trecut." },
    { status: 402 },
  );
  const { handler, saved } = fixture({ failUpgrade: declined });
  await expectFailure(
    await handler(post({ planCode: "CLUB_PRO" })),
    402,
    "PAYMENT_FAILED",
  );
  assert(saved.length === 0);
});

Deno.test("downgrade is scheduled for the end of the period through a schedule", async () => {
  const { handler, downgrades, saved, upgrades } = fixture({ coachCount: 3 });
  const response = await handler(post({ planCode: "CLUB_START" }));
  assert(response.status === 200);
  const body = await response.json();
  assert(body.result === "scheduled" && body.planCode === "CLUB_START");
  assert(body.effectiveAt === "2026-12-02T10:00:00.000Z");
  assert(upgrades.length === 0);
  assert(downgrades.length === 1);
  const params = downgrades[0];
  assert(params.scheduleId === null);
  assert(
    params.currentPriceId === "price_club" && params.priceId === "price_start",
  );
  assert(params.periodStart === periodStart && params.periodEnd === periodEnd);
  assert(params.trialEnd === null);
  assert(params.metadata.subscription_id === subscriptionId);
  assert(
    JSON.stringify(saved) ===
      JSON.stringify([{ scheduled_plan_code: "CLUB_START" }]),
  );
});

Deno.test("downgrade below the coach count is refused with the number to remove", async () => {
  const { handler, downgrades } = fixture({ coachCount: 5 });
  const body = await expectFailure(
    await handler(post({ planCode: "CLUB_START" })),
    409,
    "PLAN_BELOW_COACH_COUNT",
  );
  assert(body.coachCount === 5 && body.coachLimit === 3);
  assert(body.coachesToRemove === 2);
  assert(downgrades.length === 0);
});

Deno.test("a downgrade during a paid Stripe trial keeps the trial in the first phase", async () => {
  const trialEnd = periodEnd;
  const { handler, downgrades } = fixture({
    stripe: {
      status: "trialing",
      trialEnd,
      priceId: "price_pro",
      scheduleId: "sub_sched_2",
    },
  });
  const response = await handler(post({ planCode: "CLUB" }));
  assert(response.status === 200);
  assert(downgrades[0].trialEnd === trialEnd);
  assert(downgrades[0].scheduleId === "sub_sched_2");
  assert(downgrades[0].currentPlanCode === "CLUB_PRO");
});

Deno.test("choosing the current plan cancels a scheduled downgrade", async () => {
  const { handler, calls, saved, upgrades, downgrades } = fixture({
    stripe: { scheduleId: "sub_sched_3" },
  });
  const response = await handler(post({ planCode: "CLUB" }));
  const body = await response.json();
  assert(response.status === 200 && body.result === "kept");
  assert(calls.includes("release:sub_sched_3"));
  assert(upgrades.length === 0 && downgrades.length === 0);
  assert(
    JSON.stringify(saved) === JSON.stringify([{ scheduled_plan_code: null }]),
  );
});
