import { assert, assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import type Stripe from "https://esm.sh/stripe@14?target=deno";
import type { StripeSubscriptionState, SubscriptionPatch, SubscriptionRow } from "../_shared/subscription-sync.ts";
import { subscriptionWebhookHandler, type SubscriptionStore } from "./handler.ts";

const T0 = Date.parse("2026-11-10T10:00:00Z") / 1000;
const DAY = 86400;
const PLANS: Record<string, { code: string; subscriber_type: "COACH" | "CLUB" }> = {
  price_coach: { code: "COACH", subscriber_type: "COACH" },
  price_club: { code: "CLUB", subscriber_type: "CLUB" },
  price_start: { code: "CLUB_START", subscriber_type: "CLUB" },
};

function baseRow(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "row_coach",
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

function world(rows: SubscriptionRow[] = [baseRow()]) {
  const events = new Map<string, { type: string; processed: boolean; note: string | null }>();
  const writes: { id: string; patch: SubscriptionPatch }[] = [];
  let version = 0;
  let failNextUpdate = false;
  let concurrentWriteOnce = false;
  let stripeCalls = 0;
  let stripe: StripeSubscriptionState = {
    id: "sub_1",
    customer: "cus_1",
    status: "trialing",
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: T0 + 7 * DAY,
    current_period_end: T0 + 7 * DAY,
    price_id: "price_coach",
    latest_invoice_at: null,
  };
  const stamp = () => `2026-11-02T12:00:${String(++version).padStart(2, "0")}.000000+00:00`;

  const store: SubscriptionStore = {
    beginEvent(id, type) {
      const known = events.get(id);
      if (known?.processed) return Promise.resolve("done");
      if (!known) events.set(id, { type, processed: false, note: null });
      return Promise.resolve("process");
    },
    finishEvent(id, { processed, note }) {
      events.set(id, { ...events.get(id)!, processed, note });
      return Promise.resolve();
    },
    findRow({ subscriptionId, customerId, subscriberType, subscriberId }) {
      const found = rows.find((row) => row.stripe_subscription_id === subscriptionId) ??
        rows.find((row) =>
          subscriberType && row.subscriber_type === subscriberType &&
          (subscriberType === "COACH" ? row.coach_user_id : row.club_id) === subscriberId
        ) ??
        rows.find((row) => customerId && row.stripe_customer_id === customerId);
      return Promise.resolve(found ? { ...found } : null);
    },
    createRow(type, subscriberId, patch) {
      rows.push(baseRow({
        id: `row_${subscriberId}`,
        subscriber_type: type,
        coach_user_id: type === "COACH" ? subscriberId : null,
        club_id: type === "CLUB" ? subscriberId : null,
        stripe_customer_id: null,
        ...patch,
        updated_at: stamp(),
      }));
      return Promise.resolve();
    },
    updateRow(id, expected, patch) {
      if (failNextUpdate) {
        failNextUpdate = false;
        return Promise.reject(new Error("database offline"));
      }
      const row = rows.find((item) => item.id === id)!;
      if (concurrentWriteOnce) {
        concurrentWriteOnce = false;
        row.updated_at = stamp();
      }
      if (row.updated_at !== expected) return Promise.resolve(false);
      Object.assign(row, patch, { updated_at: stamp() });
      writes.push({ id, patch });
      return Promise.resolve(true);
    },
    planForPrice(priceId) {
      return Promise.resolve(PLANS[priceId] ?? null);
    },
  };

  const handler = subscriptionWebhookHandler({
    store,
    now: () => new Date("2026-11-12T08:00:00Z"),
    verifyEvent: (body, signature) => {
      if (signature !== "valid") return Promise.reject(new Error("bad signature"));
      return Promise.resolve(JSON.parse(body) as Stripe.Event);
    },
    subscription: (id) => {
      stripeCalls++;
      assertEquals(id, stripe.id);
      return Promise.resolve({ ...stripe });
    },
  });

  return {
    rows,
    events,
    writes,
    handler,
    stripeCalls: () => stripeCalls,
    setStripe: (patch: Partial<StripeSubscriptionState>) => {
      stripe = { ...stripe, ...patch };
    },
    failNextUpdate: () => {
      failNextUpdate = true;
    },
    concurrentWriteOnce: () => {
      concurrentWriteOnce = true;
    },
  };
}

const metadata = { subscriber_type: "COACH", subscriber_id: "coach_1" };

function event(id: string, type: string, object: Record<string, unknown>) {
  return { id, type, created: T0, data: { object } };
}

const checkoutCompleted = (id = "evt_checkout", extra: Record<string, unknown> = {}) =>
  event(id, "checkout.session.completed", {
    id: "cs_1",
    mode: "subscription",
    subscription: "sub_1",
    customer: "cus_1",
    metadata: { ...metadata, terms_version: "2026-11-05" },
    consent: { terms_of_service: "accepted" },
    ...extra,
  });
const subscriptionEvent = (id: string, type: string, status = "trialing") =>
  event(id, `customer.subscription.${type}`, { id: "sub_1", customer: "cus_1", status, metadata });
const invoiceEvent = (id: string, type: string) =>
  event(id, type, { id: `in_${id}`, subscription: "sub_1", customer: "cus_1", subscription_details: { metadata } });

function send(handler: (req: Request) => Promise<Response>, body: unknown, signature: string | null = "valid") {
  return handler(new Request("http://local/stripe-subscription-webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: signature ? { "stripe-signature": signature } : {},
  }));
}

Deno.test("missing or invalid signature returns 400 and writes nothing", async () => {
  const w = world();
  assertEquals((await send(w.handler, checkoutCompleted(), null)).status, 400);
  assertEquals((await send(w.handler, checkoutCompleted(), "forged")).status, 400);
  assertEquals(w.events.size, 0);
  assertEquals(w.writes.length, 0);
  assertEquals(w.stripeCalls(), 0);
});

Deno.test("checkout completion stores the trial, plan, Stripe ids and accepted terms", async () => {
  const w = world();
  const response = await send(w.handler, checkoutCompleted());
  assertEquals(response.status, 200);
  const row = w.rows[0];
  assertEquals(row.status, "trialing");
  assertEquals(row.plan_code, "COACH");
  assertEquals(row.stripe_subscription_id, "sub_1");
  assertEquals(row.trial_end, "2026-11-17T10:00:00.000Z");
  assertEquals(row.terms_version, "2026-11-05");
  assertEquals(row.terms_accepted_at, "2026-11-10T10:00:00.000Z");
  assertEquals(w.events.get("evt_checkout"), { type: "checkout.session.completed", processed: true, note: null });
});

Deno.test("enrollment checkouts and unrelated events are ignored without writes", async () => {
  const w = world();
  assertEquals((await send(w.handler, checkoutCompleted("evt_pay", { mode: "payment", subscription: null }))).status, 200);
  assertEquals((await send(w.handler, event("evt_pi", "payment_intent.succeeded", { id: "pi_1" }))).status, 200);
  assertEquals((await send(w.handler, event("evt_inv", "invoice.paid", { id: "in_1", subscription: null }))).status, 200);
  assertEquals(w.events.size, 0);
  assertEquals(w.writes.length, 0);
});

Deno.test("the same event delivered twice changes nothing the second time", async () => {
  const w = world();
  await send(w.handler, checkoutCompleted());
  const snapshot = JSON.stringify(w.rows);
  const calls = w.stripeCalls();
  const second = await send(w.handler, checkoutCompleted());
  assertEquals(second.status, 200);
  assertEquals((await second.json()).duplicate, true);
  assertEquals(JSON.stringify(w.rows), snapshot);
  assertEquals(w.stripeCalls(), calls);
});

Deno.test("a different event with the same state performs no write", async () => {
  const w = world();
  await send(w.handler, checkoutCompleted());
  const writes = w.writes.length;
  const response = await send(w.handler, subscriptionEvent("evt_created", "created"));
  assertEquals((await response.json()).outcome, "unchanged");
  assertEquals(w.writes.length, writes);
});

Deno.test("events delivered out of order converge to Stripe's current state", async () => {
  const orders = [
    ["created", "paid", "updated", "checkout"],
    ["paid", "updated", "checkout", "created"],
    ["updated", "checkout", "created", "paid"],
  ];
  for (const order of orders) {
    const w = world();
    w.setStripe({ status: "active", trial_end: null, current_period_end: T0 + 30 * DAY, latest_invoice_at: T0 });
    const byName: Record<string, unknown> = {
      created: subscriptionEvent("evt_created", "created", "trialing"),
      updated: subscriptionEvent("evt_updated", "updated", "trialing"),
      paid: invoiceEvent("evt_paid", "invoice.paid"),
      checkout: checkoutCompleted(),
    };
    for (const name of order) assertEquals((await send(w.handler, byName[name])).status, 200);
    assertEquals(w.rows[0].status, "active", order.join(","));
    assertEquals(w.rows[0].current_period_end, "2026-12-10T10:00:00.000Z");
    assertEquals(w.rows[0].terms_version, "2026-11-05");
  }
});

Deno.test("a late stale event cannot roll the row back", async () => {
  const w = world();
  w.setStripe({ status: "active", current_period_end: T0 + 30 * DAY });
  await send(w.handler, invoiceEvent("evt_paid", "invoice.paid"));
  await send(w.handler, subscriptionEvent("evt_old_trial", "updated", "trialing"));
  assertEquals(w.rows[0].status, "active");
});

Deno.test("failed renewal starts the 7-day grace once; payment clears it", async () => {
  const w = world([baseRow({ status: "active", stripe_subscription_id: "sub_1", plan_code: "COACH" })]);
  w.setStripe({ status: "past_due", trial_end: null, current_period_end: T0 + 30 * DAY, latest_invoice_at: T0 });
  await send(w.handler, invoiceEvent("evt_fail_1", "invoice.payment_failed"));
  assertEquals(w.rows[0].status, "past_due");
  assertEquals(w.rows[0].past_due_since, "2026-11-10T10:00:00.000Z");
  w.setStripe({ latest_invoice_at: T0 + 3 * DAY });
  await send(w.handler, invoiceEvent("evt_fail_2", "invoice.payment_failed"));
  assertEquals(w.rows[0].past_due_since, "2026-11-10T10:00:00.000Z");
  w.setStripe({ status: "active" });
  await send(w.handler, invoiceEvent("evt_paid", "invoice.paid"));
  assertEquals(w.rows[0].status, "active");
  assertEquals(w.rows[0].past_due_since, null);
});

Deno.test("cancellation at period end then deletion ends in expired", async () => {
  const w = world([baseRow({ status: "active", stripe_subscription_id: "sub_1", plan_code: "COACH" })]);
  w.setStripe({ status: "active", cancel_at_period_end: true, current_period_end: T0 + 30 * DAY });
  await send(w.handler, subscriptionEvent("evt_cancel", "updated", "active"));
  assertEquals(w.rows[0].status, "canceled");
  assertEquals(w.rows[0].cancel_at_period_end, true);
  w.setStripe({ status: "canceled" });
  await send(w.handler, subscriptionEvent("evt_deleted", "deleted", "canceled"));
  assertEquals(w.rows[0].status, "expired");
});

Deno.test("incomplete or abandoned first payments keep the local trial", async () => {
  const w = world();
  w.setStripe({ status: "incomplete" });
  await send(w.handler, subscriptionEvent("evt_incomplete", "created", "incomplete"));
  w.setStripe({ status: "incomplete_expired" });
  await send(w.handler, subscriptionEvent("evt_expired", "updated", "incomplete_expired"));
  assertEquals(w.rows[0].status, "trialing");
  assertEquals(w.rows[0].stripe_subscription_id, null);
  assert(w.events.get("evt_expired")!.processed);
});

Deno.test("scheduled downgrade is applied when Stripe starts billing the smaller plan", async () => {
  const club = baseRow({
    id: "row_club",
    subscriber_type: "CLUB",
    coach_user_id: null,
    club_id: "club_1",
    status: "active",
    plan_code: "CLUB",
    scheduled_plan_code: "CLUB_START",
    stripe_subscription_id: "sub_1",
  });
  const w = world([club]);
  w.setStripe({ status: "active", price_id: "price_club", current_period_end: T0 });
  await send(w.handler, subscriptionEvent("evt_before", "updated", "active"));
  assertEquals(w.rows[0].scheduled_plan_code, "CLUB_START");
  w.setStripe({ price_id: "price_start", current_period_end: T0 + 30 * DAY });
  await send(w.handler, subscriptionEvent("evt_rollover", "updated", "active"));
  assertEquals(w.rows[0].plan_code, "CLUB_START");
  assertEquals(w.rows[0].scheduled_plan_code, null);
  assertEquals(w.rows[0].current_period_end, "2026-12-10T10:00:00.000Z");
});

Deno.test("a concurrent write is retried against fresh data", async () => {
  const w = world();
  w.concurrentWriteOnce();
  const response = await send(w.handler, checkoutCompleted());
  assertEquals(response.status, 200);
  assertEquals(w.rows[0].stripe_subscription_id, "sub_1");
  assertEquals(w.stripeCalls(), 2);
});

Deno.test("a storage failure returns 500, records the error and the redelivery succeeds", async () => {
  const w = world();
  w.failNextUpdate();
  assertEquals((await send(w.handler, checkoutCompleted())).status, 500);
  assertEquals(w.events.get("evt_checkout"), { type: "checkout.session.completed", processed: false, note: "database offline" });
  assertEquals(w.rows[0].stripe_subscription_id, null);
  assertEquals((await send(w.handler, checkoutCompleted())).status, 200);
  assertEquals(w.rows[0].stripe_subscription_id, "sub_1");
  assert(w.events.get("evt_checkout")!.processed);
});

Deno.test("an unknown Stripe price or a plan for the wrong subscriber is refused", async () => {
  const w = world();
  w.setStripe({ price_id: "price_unknown" });
  assertEquals((await send(w.handler, checkoutCompleted())).status, 500);
  w.setStripe({ price_id: "price_club" });
  assertEquals((await send(w.handler, checkoutCompleted("evt_wrong_type"))).status, 500);
  assertEquals(w.writes.length, 0);
  assertEquals(w.events.get("evt_wrong_type")!.processed, false);
});

Deno.test("a subscriber without a row gets one from the subscription metadata", async () => {
  const w = world([]);
  await send(w.handler, checkoutCompleted());
  assertEquals(w.rows.length, 1);
  assertEquals(w.rows[0].coach_user_id, "coach_1");
  assertEquals(w.rows[0].status, "trialing");
});

Deno.test("an event with no known subscriber is recorded and not retried", async () => {
  const w = world([]);
  const response = await send(w.handler, event("evt_orphan", "customer.subscription.updated", { id: "sub_1", customer: "cus_x", metadata: {} }));
  assertEquals(response.status, 200);
  assertEquals(w.events.get("evt_orphan"), {
    type: "customer.subscription.updated",
    processed: true,
    note: "skipped: subscriber unknown",
  });
});
