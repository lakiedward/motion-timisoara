import {
  dueSubscriptionEmails,
  type EmailInvoice,
  type EmailSettings,
  type EmailSubscription,
  emailsMode,
  recipientAllowed,
  testRecipients,
} from "../_shared/subscription-emails.ts";
import { renderSubscriptionEmail, type SubscriptionEmailContext } from "../_shared/subscription-email-templates.ts";
import { resendSender } from "./resend.ts";
import { type Claim, type EmailStore, previewEmails, runSubscriptionEmails } from "./run.ts";

function assertEquals(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
}

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(label);
}

const NOW = new Date("2026-11-05T10:00:00Z");
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString();
const NO_LAUNCH: EmailSettings = { launch_at: null, launch_trial_days: 90 };

function sub(patch: Partial<EmailSubscription>): EmailSubscription {
  return {
    id: "sub-1",
    subscriber_type: "COACH",
    coach_user_id: "user-1",
    club_id: null,
    plan_code: "COACH",
    status: "trialing",
    trial_end: null,
    current_period_end: null,
    past_due_since: null,
    cancel_at_period_end: false,
    stripe_subscription_id: null,
    updated_at: day(-20),
    ...patch,
  };
}

function invoice(patch: Partial<EmailInvoice>): EmailInvoice {
  return {
    stripe_invoice_id: "in_1",
    subscription_id: "sub-1",
    status: "PAID",
    amount: 10_000,
    currency: "RON",
    hosted_invoice_url: null,
    period_end: day(30),
    paid_at: day(-1),
    updated_at: day(-1),
    ...patch,
  };
}

const kinds = (subscriptions: EmailSubscription[], invoices: EmailInvoice[] = [], settings = NO_LAUNCH) =>
  dueSubscriptionEmails(subscriptions, invoices, settings, NOW).map((item) => item.kind);

Deno.test("trial reminders fire 14 and 3 days before the trial ends, once per window", () => {
  assertEquals(kinds([sub({ trial_end: day(20) })]), [], "20 days left");
  assertEquals(kinds([sub({ trial_end: day(14) })]), ["TRIAL_ENDS_14"], "14 days left");
  assertEquals(kinds([sub({ trial_end: day(5) })]), ["TRIAL_ENDS_14"], "5 days left keeps the 14-day key");
  assertEquals(kinds([sub({ trial_end: day(3) })]), ["TRIAL_ENDS_3"], "3 days left");
  assertEquals(kinds([sub({ trial_end: day(0.5) })]), ["TRIAL_ENDS_3"], "12 hours left");
  assertEquals(kinds([sub({ trial_end: day(10), status: "active" })]), [], "not trialing");
  const [first] = dueSubscriptionEmails([sub({ trial_end: day(10) })], [], NO_LAUNCH, NOW);
  assertEquals(first.dedupeKey, `trial14:sub-1:${day(10).slice(0, 10)}`, "dedupe key tied to the trial end");
});

Deno.test("launch promo trials have no reminder before launch and use launch_at after", () => {
  assertEquals(kinds([sub({})]), [], "launch_at NULL means no trial end");
  const launched = { launch_at: day(-80), launch_trial_days: 90 };
  assertEquals(kinds([sub({})], [], launched), ["TRIAL_ENDS_14"], "promo ends in 10 days");
});

Deno.test("subscription ended: canceled, past grace, trial without card, expired", () => {
  assertEquals(kinds([sub({ status: "canceled", current_period_end: day(-1) })]), ["SUBSCRIPTION_ENDED"], "canceled");
  assertEquals(kinds([sub({ status: "canceled", current_period_end: day(5) })]), [], "canceled, period still running");
  assertEquals(kinds([sub({ status: "canceled", current_period_end: day(-10) })]), [], "too old for an email");
  assertEquals(kinds([sub({ status: "past_due", past_due_since: day(-8) })]), ["SUBSCRIPTION_ENDED"], "grace over");
  assertEquals(kinds([sub({ status: "past_due", past_due_since: day(-2) })]), [], "still in grace");
  assertEquals(kinds([sub({ trial_end: day(-1) })]), ["SUBSCRIPTION_ENDED"], "trial ended without a card");
  assertEquals(kinds([sub({ trial_end: day(-1), stripe_subscription_id: "sub_X" })]), [], "Stripe converts it");
  assertEquals(kinds([sub({ status: "expired" })]), ["SUBSCRIPTION_ENDED"], "expired without dates");
  const ended = dueSubscriptionEmails(
    [sub({ status: "canceled", current_period_end: day(-1) })], [], NO_LAUNCH, NOW, new Set(["sub-1"]),
  );
  assertEquals(ended.length, 0, "no second end email within the cooldown");
});

Deno.test("cancellation is confirmed once, while access still runs, and silences trial reminders", () => {
  const paidCanceled = sub({
    status: "canceled",
    current_period_end: day(20),
    cancel_at_period_end: true,
    stripe_subscription_id: "sub_X",
    updated_at: day(-0.1),
  });
  assertEquals(kinds([paidCanceled]), ["CANCELLATION_CONFIRMED"], "paid subscription canceled at period end");
  const [first] = dueSubscriptionEmails([paidCanceled], [], NO_LAUNCH, NOW);
  assertEquals(first.dedupeKey, `canceled:sub-1:${day(20).slice(0, 10)}`, "one email per access end");
  assertEquals(first.date, day(20), "the email names the last day of access");

  const trialCanceled = sub({
    trial_end: day(10),
    current_period_end: day(10),
    cancel_at_period_end: true,
    stripe_subscription_id: "sub_X",
    updated_at: day(-1),
  });
  assertEquals(kinds([trialCanceled]), ["CANCELLATION_CONFIRMED"], "trial with a card canceled: no charge reminder");
  assertEquals(kinds([{ ...trialCanceled, updated_at: day(-4) }]), [], "old cancellation from before the emails");
  assertEquals(kinds([{ ...paidCanceled, current_period_end: day(-1) }]), ["SUBSCRIPTION_ENDED"], "after the end only the end email");
  assertEquals(kinds([sub({ status: "canceled", current_period_end: day(20), updated_at: day(-1) })]), [], "no Stripe subscription");
});

Deno.test("invoices: paid confirmation and failed payment, recent only", () => {
  const subscriptions = [sub({ status: "active" })];
  assertEquals(kinds(subscriptions, [invoice({})]), ["PAYMENT_CONFIRMED"], "paid");
  assertEquals(kinds(subscriptions, [invoice({ amount: 0 })]), [], "zero-amount trial invoice");
  assertEquals(kinds(subscriptions, [invoice({ paid_at: day(-5) })]), [], "old payment");
  assertEquals(kinds(subscriptions, [invoice({ status: "FAILED", paid_at: null })]), ["PAYMENT_FAILED"], "failed");
  assertEquals(kinds(subscriptions, [invoice({ subscription_id: "other" })]), [], "unknown subscription");
  const [paid] = dueSubscriptionEmails(subscriptions, [invoice({})], NO_LAUNCH, NOW);
  assertEquals(paid.dedupeKey, "paid:in_1", "one email per invoice");
});

Deno.test("mode and test allowlist decide who can receive", () => {
  assertEquals(emailsMode(undefined), "off", "default off");
  assertEquals(emailsMode("LIVE"), "off", "unknown values stay off");
  const allowed = testRecipients(" Test@Example.com, , nope ");
  assertEquals([...allowed], ["test@example.com"], "normalized list");
  assertEquals(recipientAllowed("test", allowed, "test@example.com"), true, "test allowed");
  assertEquals(recipientAllowed("test", allowed, "real@client.ro"), false, "test blocks real users");
  assertEquals(recipientAllowed("live", allowed, "real@client.ro"), true, "live sends");
  assertEquals(recipientAllowed("off", allowed, "test@example.com"), false, "off sends nothing");
  assertEquals(recipientAllowed("live", allowed, null), false, "no email");
});

const baseContext: SubscriptionEmailContext = {
  kind: "TRIAL_ENDS_3",
  subscriberType: "CLUB",
  recipientName: "Ana",
  clubName: "Clubul <Delfinul>",
  planName: "Club",
  planPriceBani: 34_900,
  hasCard: false,
  date: "2026-11-08T10:00:00Z",
  amountBani: 34_900,
  currency: "RON",
  periodEnd: "2026-12-08T10:00:00Z",
  invoiceUrl: "https://invoice.stripe.com/i/abc",
  siteUrl: "https://motionromania.ro/",
};

Deno.test("templates are Romanian, link to the website and escape names", () => {
  const trial = renderSubscriptionEmail(baseContext);
  assertEquals(trial.subject, "Mai ai puțin: perioada de probă se încheie pe 8 noiembrie 2026", "trial subject");
  assert(trial.html.includes('href="https://motionromania.ro/club/abonament"'), "club link");
  assert(trial.html.includes("Clubul &lt;Delfinul&gt;"), "escaped club name");
  assert(!trial.html.includes("<Delfinul>"), "no raw html from data");
  assert(trial.text.includes("Alege abonamentul: https://motionromania.ro/club/abonament"), "text link");

  const card = renderSubscriptionEmail({ ...baseContext, kind: "TRIAL_ENDS_14", hasCard: true, subscriberType: "COACH" });
  assert(card.text.includes("349,00 lei pe lună"), "automatic charge amount");
  assert(card.html.includes("https://motionromania.ro/coach/abonament"), "coach link");

  const failed = renderSubscriptionEmail({ ...baseContext, kind: "PAYMENT_FAILED" });
  assertEquals(failed.subject, "Plata abonamentului nu a reușit", "failed subject");
  assert(failed.text.includes("349,00 lei"), "failed amount");

  const paid = renderSubscriptionEmail({ ...baseContext, kind: "PAYMENT_CONFIRMED" });
  assert(paid.text.includes("activ până pe 8 decembrie 2026"), "period end");
  assert(paid.text.includes("https://invoice.stripe.com/i/abc"), "receipt link");

  const ended = renderSubscriptionEmail({ ...baseContext, kind: "SUBSCRIPTION_ENDED" });
  assertEquals(ended.subject, "Abonamentul tău Motion România s-a încheiat", "ended subject");
  const canceled = renderSubscriptionEmail({ ...baseContext, kind: "CANCELLATION_CONFIRMED", date: "2026-12-08T10:00:00Z" });
  assertEquals(canceled.subject, "Am înregistrat anularea abonamentului", "cancellation subject");
  assert(canceled.text.includes("Nu se mai face nicio plată."), "no further charge");
  assert(canceled.text.includes("Până pe 8 decembrie 2026"), "access end date");
  assert(canceled.html.includes('href="https://motionromania.ro/club/abonament"'), "cancellation link");
  assertEquals(previewEmails("https://motionromania.ro", NOW, "COACH").length, 6, "six previews");
});

function memoryStore(subscriptions: EmailSubscription[], email: string | null) {
  const log = new Map<string, { status: string; attempts: number }>();
  const finished: string[] = [];
  const store: EmailStore = {
    settings: () => Promise.resolve(NO_LAUNCH),
    subscriptions: () => Promise.resolve(subscriptions),
    invoices: () => Promise.resolve([]),
    recentlyEnded: () => Promise.resolve(new Set()),
    recipient: () => Promise.resolve({ email, name: "Ana", clubName: null }),
    plan: () => Promise.resolve({ name: "Antrenor", price_bani: 10_000 }),
    claim(due) {
      const row = log.get(due.dedupeKey);
      if (!row) {
        log.set(due.dedupeKey, { status: "PENDING", attempts: 1 });
        return Promise.resolve({ id: due.dedupeKey });
      }
      if (row.status !== "FAILED" || row.attempts >= 3) return Promise.resolve(null);
      row.status = "PENDING";
      row.attempts++;
      return Promise.resolve({ id: due.dedupeKey });
    },
    finish(claim: Claim, result) {
      log.get(claim.id)!.status = result.status;
      finished.push(result.status);
      return Promise.resolve();
    },
  };
  return { store, log, finished };
}

Deno.test("run: test mode skips real users, sends to test accounts, never twice, retries failures", async () => {
  const subscriptions = [sub({ trial_end: day(10) })];
  const sent: string[] = [];
  const sender = { send: (to: string) => { sent.push(to); return Promise.resolve({ id: "re_1" }); } };

  const off = await runSubscriptionEmails({ store: memoryStore(subscriptions, "a@b.ro").store, sender, mode: "off", allowed: new Set(), siteUrl: "https://motionromania.ro", now: NOW });
  assertEquals([off.due, sent.length], [0, 0], "off does nothing");

  const keyless = memoryStore(subscriptions, "qa@test.ro");
  const noKey = await runSubscriptionEmails({ store: keyless.store, sender: null, mode: "test", allowed: new Set(["qa@test.ro"]), siteUrl: "https://motionromania.ro", now: NOW });
  assertEquals([noKey.due, keyless.log.size], [0, 0], "missing Resend key claims nothing, so emails go out once the key is set");

  const real = memoryStore(subscriptions, "client@real.ro");
  const skipped = await runSubscriptionEmails({ store: real.store, sender, mode: "test", allowed: new Set(["qa@test.ro"]), siteUrl: "https://motionromania.ro", now: NOW });
  assertEquals([skipped.skipped, sent.length], [1, 0], "real user skipped in test mode");

  const qa = memoryStore(subscriptions, "qa@test.ro");
  const options = { store: qa.store, sender, mode: "test" as const, allowed: new Set(["qa@test.ro"]), siteUrl: "https://motionromania.ro", now: NOW };
  assertEquals((await runSubscriptionEmails(options)).sent, 1, "test account receives");
  assertEquals((await runSubscriptionEmails(options)).sent, 0, "not sent twice");
  assertEquals(sent, ["qa@test.ro"], "one send");

  const flaky = memoryStore(subscriptions, "qa@test.ro");
  let calls = 0;
  const failing = { send: () => { calls++; return calls === 1 ? Promise.reject(new Error("timeout")) : Promise.resolve({ id: "re_2" }); } };
  const flakyOptions = { ...options, store: flaky.store, sender: failing };
  assertEquals((await runSubscriptionEmails(flakyOptions)).failed, 1, "first attempt fails");
  assertEquals((await runSubscriptionEmails(flakyOptions)).sent, 1, "retried next run");
  assertEquals(flaky.finished, ["FAILED", "SENT"], "log statuses");
});

Deno.test("resend sender posts one email with an idempotency key and surfaces errors", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const ok = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({ id: "re_123" }), { status: 200 });
  }) as unknown as typeof fetch;
  const email = { subject: "S", html: "<p>H</p>", text: "T" };
  const result = await resendSender("key", "Motion România <no-reply@motionromania.ro>", ok).send("a@b.ro", email, "trial3:x");
  assertEquals(result.id, "re_123", "message id");
  const headers = new Headers(requests[0].init.headers);
  assertEquals(headers.get("Idempotency-Key"), "trial3:x", "idempotency key");
  assertEquals(JSON.parse(String(requests[0].init.body)).to, ["a@b.ro"], "single recipient");

  const bad = (() => Promise.resolve(new Response(JSON.stringify({ message: "domain not verified" }), { status: 403 }))) as unknown as typeof fetch;
  let message = "";
  try {
    await resendSender("key", "x", bad).send("a@b.ro", email, "k");
  } catch (error) {
    message = (error as Error).message;
  }
  assertEquals(message, "Resend 403: domain not verified", "error surfaced");
});
