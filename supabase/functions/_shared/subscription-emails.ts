export type SubscriptionEmailKind =
  | "TRIAL_ENDS_14"
  | "TRIAL_ENDS_3"
  | "PAYMENT_FAILED"
  | "PAYMENT_CONFIRMED"
  | "SUBSCRIPTION_ENDED";

export type SubscriptionEmailsMode = "off" | "test" | "live";

export interface EmailSubscription {
  id: string;
  subscriber_type: "COACH" | "CLUB";
  coach_user_id: string | null;
  club_id: string | null;
  plan_code: string | null;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  trial_end: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  stripe_subscription_id: string | null;
}

export interface EmailInvoice {
  stripe_invoice_id: string;
  subscription_id: string | null;
  status: "PAID" | "FAILED" | "REFUNDED";
  amount: number;
  currency: string;
  hosted_invoice_url: string | null;
  period_end: string | null;
  paid_at: string | null;
  updated_at: string;
}

export interface EmailSettings {
  launch_at: string | null;
  launch_trial_days: number;
}

export interface DueEmail {
  kind: SubscriptionEmailKind;
  subscriptionId: string;
  dedupeKey: string;
  date: string | null;
  invoice: EmailInvoice | null;
}

const DAY_MS = 86_400_000;
export const EVENT_LOOKBACK_MS = 3 * DAY_MS;
export const PAST_DUE_GRACE_MS = 7 * DAY_MS;

const time = (value: string | null) => (value ? Date.parse(value) : NaN);
const dayKey = (value: string) => new Date(value).toISOString().slice(0, 10);

export function emailsMode(value: string | undefined): SubscriptionEmailsMode {
  return value === "test" || value === "live" ? value : "off";
}

export function testRecipients(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter((item) => item.includes("@")),
  );
}

export function recipientAllowed(
  mode: SubscriptionEmailsMode,
  allowed: Set<string>,
  email: string | null,
): boolean {
  if (!email || mode === "off") return false;
  return mode === "live" || allowed.has(email.trim().toLowerCase());
}

export function trialEndsAt(subscription: EmailSubscription, settings: EmailSettings): string | null {
  if (subscription.trial_end) return subscription.trial_end;
  if (!settings.launch_at) return null;
  return new Date(time(settings.launch_at) + settings.launch_trial_days * DAY_MS).toISOString();
}

export function accessEndedAt(
  subscription: EmailSubscription,
  settings: EmailSettings,
  now: Date,
): string | null {
  const at = now.getTime();
  if (subscription.status === "canceled") {
    return time(subscription.current_period_end) <= at ? subscription.current_period_end : null;
  }
  if (subscription.status === "past_due" && subscription.past_due_since) {
    const end = time(subscription.past_due_since) + PAST_DUE_GRACE_MS;
    return end <= at ? new Date(end).toISOString() : null;
  }
  if (subscription.status === "trialing" && !subscription.stripe_subscription_id) {
    const end = trialEndsAt(subscription, settings);
    return end && time(end) <= at ? end : null;
  }
  if (subscription.status === "expired") {
    return subscription.current_period_end ?? subscription.trial_end ?? null;
  }
  return null;
}

function trialEmail(subscription: EmailSubscription, settings: EmailSettings, now: Date): DueEmail | null {
  if (subscription.status !== "trialing") return null;
  const end = trialEndsAt(subscription, settings);
  if (!end) return null;
  const left = time(end) - now.getTime();
  if (left <= 0 || left > 14 * DAY_MS) return null;
  const kind = left <= 3 * DAY_MS ? "TRIAL_ENDS_3" : "TRIAL_ENDS_14";
  const prefix = kind === "TRIAL_ENDS_3" ? "trial3" : "trial14";
  return { kind, subscriptionId: subscription.id, dedupeKey: `${prefix}:${subscription.id}:${dayKey(end)}`, date: end, invoice: null };
}

function endedEmail(subscription: EmailSubscription, settings: EmailSettings, now: Date): DueEmail | null {
  const end = accessEndedAt(subscription, settings, now);
  if (subscription.status === "expired" && !end) {
    return { kind: "SUBSCRIPTION_ENDED", subscriptionId: subscription.id, dedupeKey: `ended:${subscription.id}:expired`, date: null, invoice: null };
  }
  if (!end || now.getTime() - time(end) > EVENT_LOOKBACK_MS) return null;
  return { kind: "SUBSCRIPTION_ENDED", subscriptionId: subscription.id, dedupeKey: `ended:${subscription.id}:${dayKey(end)}`, date: end, invoice: null };
}

function invoiceEmail(invoice: EmailInvoice, now: Date): DueEmail | null {
  if (!invoice.subscription_id) return null;
  if (invoice.status === "FAILED") {
    if (now.getTime() - time(invoice.updated_at) > EVENT_LOOKBACK_MS) return null;
    return { kind: "PAYMENT_FAILED", subscriptionId: invoice.subscription_id, dedupeKey: `failed:${invoice.stripe_invoice_id}`, date: invoice.updated_at, invoice };
  }
  if (invoice.status === "PAID" && invoice.amount > 0 && invoice.paid_at) {
    if (now.getTime() - time(invoice.paid_at) > EVENT_LOOKBACK_MS) return null;
    return { kind: "PAYMENT_CONFIRMED", subscriptionId: invoice.subscription_id, dedupeKey: `paid:${invoice.stripe_invoice_id}`, date: invoice.paid_at, invoice };
  }
  return null;
}

export function dueSubscriptionEmails(
  subscriptions: EmailSubscription[],
  invoices: EmailInvoice[],
  settings: EmailSettings,
  now: Date,
  recentlyEnded: Set<string> = new Set(),
): DueEmail[] {
  const known = new Set(subscriptions.map((subscription) => subscription.id));
  const due: DueEmail[] = [];
  for (const subscription of subscriptions) {
    const email = trialEmail(subscription, settings, now) ?? endedEmail(subscription, settings, now);
    if (email && !(email.kind === "SUBSCRIPTION_ENDED" && recentlyEnded.has(subscription.id))) due.push(email);
  }
  for (const invoice of invoices) {
    const email = invoiceEmail(invoice, now);
    if (email && known.has(email.subscriptionId)) due.push(email);
  }
  return due;
}
