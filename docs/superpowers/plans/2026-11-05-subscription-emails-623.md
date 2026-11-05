# Subscription emails (feature #623)

## Goal

Coaches and clubs receive Romanian emails from `Motion România <no-reply@motionromania.ro>` when:

| Kind | When | Dedupe key |
|---|---|---|
| `TRIAL_ENDS_14` | trialing, trial ends in 3–14 days | `trial14:<subscription>:<trial end day>` |
| `TRIAL_ENDS_3` | trialing, trial ends in 0–3 days | `trial3:<subscription>:<trial end day>` |
| `PAYMENT_FAILED` | invoice `FAILED` in the last 3 days | `failed:<invoice>` |
| `PAYMENT_CONFIRMED` | invoice `PAID`, amount > 0, paid in the last 3 days | `paid:<invoice>` |
| `SUBSCRIPTION_ENDED` | access ended in the last 3 days (canceled after period end, past_due after 7-day grace, trial ended without card, expired) | `ended:<subscription>:<end day>`, at most one per 30 days |

The trial end is `trial_end`, or `launch_at + launch_trial_days` for launch-promo rows. While `launch_at` is NULL, promo rows have no trial end and get no reminder. Every link goes to the website (`/coach/abonament` or `/club/abonament`), never into the app.

## Design

- `send-subscription-emails` (verify_jwt, service_role only) is called hourly by pg_cron between 06:17 and 18:17 UTC, so nothing lands at night. It reads state instead of hooking into the Stripe webhook: the webhook stays untouched, a missed run catches up, and one code path handles both date-driven and event-driven emails.
- `subscription_email_log` claims each email by its unique `dedupe_key` before sending, so concurrent or repeated runs never send twice. A failed send is retried on the next runs, at most 3 attempts; Resend's `Idempotency-Key` is the same dedupe key.
- `SUBSCRIPTION_EMAILS_MODE`: `off` (default, nothing happens), `test` (only addresses in `SUBSCRIPTION_EMAILS_TEST_RECIPIENTS` receive; other due emails are logged as `SKIPPED`, which also prevents a backlog burst when switching to `live`), `live` (launch, To-Do #232).
- `{"action":"preview","to":"<allowlisted address>","subscriber_type":"COACH|CLUB"}` sends the five templates with sample data, subject prefixed `[Test]`.
- Recipient: the coach's account email, or the club owner's account email. Disabled profiles get nothing.

## Rollout (each step needs the owner's approval)

1. Owner adds `RESEND_API_KEY` (the same Resend key used by Auth SMTP, or a new sending key for `motionromania.ro`) in Supabase → Edge Functions → Secrets.
2. Apply `00121`, set `SUBSCRIPTION_EMAILS_MODE=test` and the test recipients, deploy `send-subscription-emails`.
3. Send the preview to a test inbox; run the job once; check `subscription_email_log`.
4. At launch (#232) switch the mode to `live`.

## Tradeoffs

- Hourly polling instead of webhook-triggered sending delays a payment email by up to one hour (up to ~12 hours overnight). Accepted for simplicity and safety.
- Emails skipped in test mode are not re-sent after going live; only new events are emailed.
- Stripe's hosted invoice page is linked as the payment receipt; the fiscal invoice is a separate flow (#622).
