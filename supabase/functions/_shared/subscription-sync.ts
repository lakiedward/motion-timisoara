import type Stripe from "https://esm.sh/stripe@14?target=deno";

export type SubscriberType = "COACH" | "CLUB";
export type LocalStatus = "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface SubscriptionRow {
  id: string;
  subscriber_type: SubscriberType;
  coach_user_id: string | null;
  club_id: string | null;
  plan_code: string | null;
  scheduled_plan_code: string | null;
  status: LocalStatus;
  trial_end: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  updated_at: string;
}

export type SubscriptionPatch = Partial<Omit<SubscriptionRow, "id" | "updated_at">>;

export interface PlanRef {
  code: string;
  subscriber_type: SubscriberType;
}

export interface StripeSubscriptionState {
  id: string;
  customer: string;
  status: Stripe.Subscription.Status;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  trial_end: number | null;
  current_period_end: number;
  price_id: string | null;
  latest_invoice_at: number | null;
}

export type SyncDecision =
  | { kind: "apply"; patch: SubscriptionPatch }
  | { kind: "skip"; reason: string };

const LIVE_STATUSES = new Set<Stripe.Subscription.Status>(["trialing", "active", "past_due"]);
const ENDED_STATUSES = new Set<Stripe.Subscription.Status>([
  "canceled",
  "unpaid",
  "incomplete_expired",
  "paused",
]);

const TIMESTAMP_FIELDS = new Set<string>(["trial_end", "current_period_end", "past_due_since", "terms_accepted_at"]);

export const iso =(seconds: number) => new Date(seconds * 1000).toISOString();

export function toStripeState(subscription: Stripe.Subscription): StripeSubscriptionState {
  const invoice = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
  const items = subscription.items?.data ?? [];
  if (items.length > 1) throw new Error(`Subscription ${subscription.id} has ${items.length} items`);
  return {
    id: subscription.id,
    customer: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at ?? null,
    trial_end: subscription.trial_end ?? null,
    current_period_end: subscription.current_period_end,
    price_id: items[0]?.price?.id ?? null,
    latest_invoice_at: invoice ? invoice.status_transitions?.finalized_at ?? invoice.created : null,
  };
}

export function localStatus(subscription: StripeSubscriptionState): LocalStatus | null {
  switch (subscription.status) {
    case "trialing":
      return "trialing";
    case "active":
      return subscription.cancel_at_period_end || subscription.cancel_at !== null ? "canceled" : "active";
    case "past_due":
      return "past_due";
    case "incomplete":
      return null;
    default:
      return ENDED_STATUSES.has(subscription.status) ? "expired" : null;
  }
}

export function syncDecision(
  row: SubscriptionRow | null,
  subscription: StripeSubscriptionState,
  plan: PlanRef | null,
  subscriberType: SubscriberType,
  now: Date,
): SyncDecision {
  const status = localStatus(subscription);
  if (status === null) return { kind: "skip", reason: `stripe status ${subscription.status}` };
  const tracked = row?.stripe_subscription_id ?? null;
  if (!LIVE_STATUSES.has(subscription.status) && tracked !== subscription.id) {
    return { kind: "skip", reason: "ended subscription is not the tracked one" };
  }
  if (!plan) throw new Error(`No plan for Stripe price ${subscription.price_id ?? "(none)"}`);
  if (plan.subscriber_type !== subscriberType) {
    throw new Error(`Plan ${plan.code} is for ${plan.subscriber_type}, not ${subscriberType}`);
  }

  const sameSubscription = tracked === subscription.id;
  const keepPastDueSince = status === "past_due" && sameSubscription && row?.past_due_since
    ? row.past_due_since
    : null;
  const pastDueSince = status !== "past_due"
    ? null
    : keepPastDueSince ?? (subscription.latest_invoice_at ? iso(subscription.latest_invoice_at) : now.toISOString());

  const scheduled = row?.scheduled_plan_code ?? null;
  const patch: SubscriptionPatch = {
    status,
    plan_code: plan.code,
    scheduled_plan_code: status === "expired" || scheduled === plan.code ? null : scheduled,
    current_period_end: iso(subscription.current_period_end),
    past_due_since: pastDueSince,
    cancel_at_period_end: subscription.cancel_at_period_end || subscription.cancel_at !== null,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
  };
  if (status === "trialing" && subscription.trial_end !== null) patch.trial_end = iso(subscription.trial_end);
  return { kind: "apply", patch };
}

export function changedFields(row: SubscriptionRow, patch: SubscriptionPatch): SubscriptionPatch {
  const changed: SubscriptionPatch = {};
  for (const [key, value] of Object.entries(patch) as [keyof SubscriptionPatch, unknown][]) {
    const current = row[key];
    const same = TIMESTAMP_FIELDS.has(key) ? sameInstant(current, value) : current === value;
    if (!same) (changed as Record<string, unknown>)[key] = value;
  }
  return changed;
}

function sameInstant(a: unknown, b: unknown) {
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  return new Date(String(a)).getTime() === new Date(String(b)).getTime();
}
