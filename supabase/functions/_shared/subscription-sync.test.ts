import { assertEquals, assertThrows } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import {
  changedFields,
  localStatus,
  type StripeSubscriptionState,
  type SubscriptionRow,
  syncDecision,
  toStripeState,
} from "./subscription-sync.ts";

const T0 = Date.parse("2026-11-10T10:00:00Z") / 1000;
const DAY = 86400;
const NOW = new Date("2026-11-12T08:00:00Z");
const COACH_PLAN = { code: "COACH", subscriber_type: "COACH" as const };

function stripeSub(overrides: Partial<StripeSubscriptionState> = {}): StripeSubscriptionState {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    current_period_end: T0 + 30 * DAY,
    price_id: "price_coach",
    latest_invoice_at: T0,
    ...overrides,
  };
}

function row(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "row_1",
    subscriber_type: "COACH",
    coach_user_id: "coach_1",
    club_id: null,
    plan_code: null,
    scheduled_plan_code: null,
    status: "trialing",
    trial_end: null,
    current_period_end: null,
    past_due_since: null,
    cancel_at_period_end: false,
    stripe_customer_id: "cus_1",
    stripe_subscription_id: null,
    terms_version: null,
    terms_accepted_at: null,
    updated_at: "2026-11-01T00:00:00.000000+00:00",
    ...overrides,
  };
}

const patchOf = (decision: ReturnType<typeof syncDecision>) => {
  if (decision.kind !== "apply") throw new Error(`expected apply, got skip: ${decision.reason}`);
  return decision.patch;
};

Deno.test("status mapping follows the spec table", () => {
  const cases: [Partial<StripeSubscriptionState>, string | null][] = [
    [{ status: "trialing" }, "trialing"],
    [{ status: "active" }, "active"],
    [{ status: "active", cancel_at_period_end: true }, "canceled"],
    [{ status: "active", cancel_at: T0 + 30 * DAY }, "canceled"],
    [{ status: "past_due" }, "past_due"],
    [{ status: "canceled" }, "expired"],
    [{ status: "unpaid" }, "expired"],
    [{ status: "incomplete_expired" }, "expired"],
    [{ status: "paused" }, "expired"],
    [{ status: "incomplete" }, null],
  ];
  for (const [input, expected] of cases) {
    assertEquals(localStatus(stripeSub(input)), expected, JSON.stringify(input));
  }
});

Deno.test("trialing stores Stripe's trial end and the period end", () => {
  const patch = patchOf(syncDecision(row(), stripeSub({ status: "trialing", trial_end: T0 + 5 * DAY }), COACH_PLAN, "COACH", NOW));
  assertEquals(patch.status, "trialing");
  assertEquals(patch.trial_end, "2026-11-15T10:00:00.000Z");
  assertEquals(patch.current_period_end, "2026-12-10T10:00:00.000Z");
  assertEquals(patch.stripe_subscription_id, "sub_1");
  assertEquals(patch.plan_code, "COACH");
});

Deno.test("past_due_since is set once from the failed invoice and kept on later syncs", () => {
  const first = patchOf(syncDecision(row({ stripe_subscription_id: "sub_1", status: "active" }), stripeSub({ status: "past_due" }), COACH_PLAN, "COACH", NOW));
  assertEquals(first.past_due_since, "2026-11-10T10:00:00.000Z");
  const later = patchOf(syncDecision(
    row({ stripe_subscription_id: "sub_1", status: "past_due", past_due_since: "2026-11-10T10:00:00+00:00" }),
    stripeSub({ status: "past_due", latest_invoice_at: T0 + 3 * DAY }),
    COACH_PLAN,
    "COACH",
    NOW,
  ));
  assertEquals(later.past_due_since, "2026-11-10T10:00:00+00:00");
});

Deno.test("past_due without an invoice time falls back to now", () => {
  const patch = patchOf(syncDecision(row({ stripe_subscription_id: "sub_1" }), stripeSub({ status: "past_due", latest_invoice_at: null }), COACH_PLAN, "COACH", NOW));
  assertEquals(patch.past_due_since, NOW.toISOString());
});

Deno.test("payment clears past_due_since", () => {
  const patch = patchOf(syncDecision(
    row({ stripe_subscription_id: "sub_1", status: "past_due", past_due_since: "2026-11-10T10:00:00Z" }),
    stripeSub(),
    COACH_PLAN,
    "COACH",
    NOW,
  ));
  assertEquals(patch.status, "active");
  assertEquals(patch.past_due_since, null);
});

Deno.test("incomplete leaves the local state alone", () => {
  assertEquals(syncDecision(row(), stripeSub({ status: "incomplete" }), COACH_PLAN, "COACH", NOW).kind, "skip");
});

Deno.test("an ended subscription that is not the tracked one is ignored", () => {
  assertEquals(syncDecision(row(), stripeSub({ status: "incomplete_expired" }), COACH_PLAN, "COACH", NOW).kind, "skip");
  assertEquals(
    syncDecision(row({ stripe_subscription_id: "sub_new", status: "active" }), stripeSub({ status: "canceled" }), COACH_PLAN, "COACH", NOW).kind,
    "skip",
  );
});

Deno.test("the tracked subscription ending makes the row expired and drops a scheduled plan", () => {
  const patch = patchOf(syncDecision(
    row({ stripe_subscription_id: "sub_1", status: "canceled", scheduled_plan_code: "COACH" }),
    stripeSub({ status: "canceled" }),
    COACH_PLAN,
    "COACH",
    NOW,
  ));
  assertEquals(patch.status, "expired");
  assertEquals(patch.scheduled_plan_code, null);
});

Deno.test("a new live subscription replaces an old tracked one", () => {
  const patch = patchOf(syncDecision(row({ stripe_subscription_id: "sub_old", status: "expired" }), stripeSub({ id: "sub_new" }), COACH_PLAN, "COACH", NOW));
  assertEquals(patch.stripe_subscription_id, "sub_new");
  assertEquals(patch.status, "active");
});

Deno.test("scheduled downgrade is cleared only once Stripe bills the new plan", () => {
  const club = row({ subscriber_type: "CLUB", coach_user_id: null, club_id: "club_1", stripe_subscription_id: "sub_1", status: "active", plan_code: "CLUB", scheduled_plan_code: "CLUB_START" });
  const before = patchOf(syncDecision(club, stripeSub({ price_id: "price_club" }), { code: "CLUB", subscriber_type: "CLUB" }, "CLUB", NOW));
  assertEquals(before.plan_code, "CLUB");
  assertEquals(before.scheduled_plan_code, "CLUB_START");
  const after = patchOf(syncDecision(club, stripeSub({ price_id: "price_start" }), { code: "CLUB_START", subscriber_type: "CLUB" }, "CLUB", NOW));
  assertEquals(after.plan_code, "CLUB_START");
  assertEquals(after.scheduled_plan_code, null);
});

Deno.test("unknown price or a plan of the other subscriber type is an error", () => {
  assertThrows(() => syncDecision(row(), stripeSub(), null, "COACH", NOW));
  assertThrows(() => syncDecision(row(), stripeSub(), { code: "CLUB", subscriber_type: "CLUB" }, "COACH", NOW));
});

Deno.test("changedFields compares timestamps as instants", () => {
  const current = row({ current_period_end: "2026-12-10T10:00:00+00:00", status: "active" });
  assertEquals(changedFields(current, { current_period_end: "2026-12-10T10:00:00.000Z", status: "active" }), {});
  assertEquals(changedFields(current, { status: "past_due" }), { status: "past_due" });
});

Deno.test("toStripeState reads the price, customer and failed invoice time", () => {
  const state = toStripeState({
    id: "sub_1",
    customer: { id: "cus_1" },
    status: "past_due",
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    current_period_end: T0 + 30 * DAY,
    items: { data: [{ price: { id: "price_coach" } }] },
    latest_invoice: { created: T0 - 3600, status_transitions: { finalized_at: T0 } },
  } as unknown as Stripe.Subscription);
  assertEquals(state.customer, "cus_1");
  assertEquals(state.price_id, "price_coach");
  assertEquals(state.latest_invoice_at, T0);
});
