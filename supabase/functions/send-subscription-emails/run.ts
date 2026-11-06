import {
  type DueEmail,
  dueSubscriptionEmails,
  EVENT_LOOKBACK_MS,
  type EmailInvoice,
  type EmailSettings,
  type EmailSubscription,
  recipientAllowed,
  type SubscriptionEmailKind,
  type SubscriptionEmailsMode,
} from "../_shared/subscription-emails.ts";
import { type RenderedEmail, renderSubscriptionEmail } from "../_shared/subscription-email-templates.ts";

export const MAX_ATTEMPTS = 3;
const ENDED_COOLDOWN_MS = 30 * 86_400_000;

export interface Recipient {
  email: string | null;
  name: string | null;
  clubName: string | null;
}

export interface PlanInfo {
  name: string;
  price_bani: number;
}

export interface Claim {
  id: string;
}

export interface EmailStore {
  settings(): Promise<EmailSettings>;
  subscriptions(): Promise<EmailSubscription[]>;
  invoices(since: string): Promise<EmailInvoice[]>;
  recentlyEnded(since: string): Promise<Set<string>>;
  recipient(subscription: EmailSubscription): Promise<Recipient>;
  plan(subscription: EmailSubscription): Promise<PlanInfo | null>;
  claim(due: DueEmail, recipientEmail: string | null): Promise<Claim | null>;
  finish(
    claim: Claim,
    result: { status: "SENT" | "FAILED" | "SKIPPED"; providerId?: string; error?: string },
  ): Promise<void>;
}

export interface EmailSender {
  send(to: string, email: RenderedEmail, idempotencyKey: string): Promise<{ id: string }>;
}

export interface RunOptions {
  store: EmailStore;
  sender: EmailSender | null;
  mode: SubscriptionEmailsMode;
  allowed: Set<string>;
  siteUrl: string;
  now: Date;
}

export interface RunSummary {
  mode: SubscriptionEmailsMode;
  due: number;
  sent: number;
  skipped: number;
  failed: number;
  kinds: Partial<Record<SubscriptionEmailKind, number>>;
}

export async function runSubscriptionEmails(options: RunOptions): Promise<RunSummary> {
  const { store, sender, mode, allowed, siteUrl, now } = options;
  const summary: RunSummary = { mode, due: 0, sent: 0, skipped: 0, failed: 0, kinds: {} };
  if (mode === "off" || !sender) return summary;

  const settings = await store.settings();
  const subscriptions = await store.subscriptions();
  const invoices = await store.invoices(new Date(now.getTime() - EVENT_LOOKBACK_MS).toISOString());
  const recentlyEnded = await store.recentlyEnded(new Date(now.getTime() - ENDED_COOLDOWN_MS).toISOString());
  const due = dueSubscriptionEmails(subscriptions, invoices, settings, now, recentlyEnded);
  const byId = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
  summary.due = due.length;

  for (const item of due) {
    const subscription = byId.get(item.subscriptionId)!;
    const recipient = await store.recipient(subscription);
    const claim = await store.claim(item, recipient.email);
    if (!claim) continue;
    summary.kinds[item.kind] = (summary.kinds[item.kind] ?? 0) + 1;

    if (!recipientAllowed(mode, allowed, recipient.email)) {
      await store.finish(claim, {
        status: "SKIPPED",
        error: recipient.email ? `not sent in ${mode} mode` : "no recipient email",
      });
      summary.skipped++;
      continue;
    }

    const plan = await store.plan(subscription);
    const email = renderSubscriptionEmail({
      kind: item.kind,
      subscriberType: subscription.subscriber_type,
      recipientName: recipient.name,
      clubName: recipient.clubName,
      planName: plan?.name ?? null,
      planPriceBani: plan?.price_bani ?? null,
      hasCard: Boolean(subscription.stripe_subscription_id),
      date: item.date,
      amountBani: item.invoice?.amount ?? null,
      currency: item.invoice?.currency ?? null,
      periodEnd: item.invoice?.period_end ?? null,
      invoiceUrl: item.invoice?.hosted_invoice_url ?? null,
      siteUrl,
    });
    try {
      const result = await sender.send(recipient.email!, email, item.dedupeKey);
      await store.finish(claim, { status: "SENT", providerId: result.id });
      summary.sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.finish(claim, { status: "FAILED", error: message.slice(0, 1000) });
      summary.failed++;
    }
  }
  return summary;
}

const SAMPLE_KINDS: SubscriptionEmailKind[] = [
  "TRIAL_ENDS_14",
  "TRIAL_ENDS_3",
  "PAYMENT_FAILED",
  "PAYMENT_CONFIRMED",
  "CANCELLATION_CONFIRMED",
  "SUBSCRIPTION_ENDED",
];

export function previewEmails(siteUrl: string, now: Date, subscriberType: "COACH" | "CLUB"): RenderedEmail[] {
  const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  return SAMPLE_KINDS.map((kind) => {
    const email = renderSubscriptionEmail({
      kind,
      subscriberType,
      recipientName: "Ana",
      clubName: subscriberType === "CLUB" ? "CS Delfinul" : null,
      planName: subscriberType === "CLUB" ? "Club" : "Antrenor",
      planPriceBani: subscriberType === "CLUB" ? 34_900 : 10_000,
      hasCard: false,
      date: kind === "TRIAL_ENDS_14"
        ? inDays(14)
        : kind === "TRIAL_ENDS_3"
        ? inDays(3)
        : kind === "CANCELLATION_CONFIRMED"
        ? inDays(30)
        : now.toISOString(),
      amountBani: subscriberType === "CLUB" ? 34_900 : 10_000,
      currency: "RON",
      periodEnd: inDays(30),
      invoiceUrl: null,
      siteUrl,
    });
    return { ...email, subject: `[Test] ${email.subject}` };
  });
}
