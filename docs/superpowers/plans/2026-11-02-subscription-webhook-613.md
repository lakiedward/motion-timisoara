# Subscription webhook (feature #613)

Spec: [2026-11-02-abonamente-antrenori-cluburi.md](../specs/2026-11-02-abonamente-antrenori-cluburi.md), section "#613 Webhook" and "Stripe Billing design".
Tracker: Team Tracker project 16, feature #613, plan v40 item 1290.

## What it does

`supabase/functions/stripe-subscription-webhook` is a separate endpoint from `stripe-webhook` (enrollments), with its own signing secret `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`.

1. Verifies the Stripe signature on the raw body. A missing or invalid signature returns 400 before anything is read or written.
2. Handles `checkout.session.completed` (only `mode=subscription`), `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`. Every other event, and invoices without a subscription, return 200 without writes.
3. Records the event id in `subscription_events`. An event already marked processed returns `duplicate: true` without calling Stripe or writing.
4. Finds the subscription row by `stripe_subscription_id`, then by the row id (`client_reference_id` or `metadata.subscription_id`), then by the `subscriber_type` / `subscriber_id` metadata, then by `stripe_customer_id`.
5. Re-reads the subscription from the Stripe API (`expand: latest_invoice`) and computes the row from Stripe's current state, so repeated and out-of-order events converge.
6. Writes only the fields that changed, with a compare-and-set on `updated_at`. If another writer changed the row in between, it re-reads the row and Stripe and tries again (3 attempts).
7. On failure it stores the error on the event, leaves it unprocessed and returns 500, so Stripe redelivers.

## Mapping decisions

- Status mapping exactly as the spec table. `paused` (not in the spec) maps to `expired`, because a paused subscription is not being paid.
- `past_due_since` is set once, from the failed invoice's finalization time (fallback: now), and kept while the same subscription stays past due. Any other state clears it. Using the invoice time rather than the period start keeps a failed mid-period upgrade charge from starting the grace weeks in the past.
- An ended subscription (`canceled`, `unpaid`, `incomplete_expired`, `paused`) changes the row only when it is the subscription the row tracks. This covers the spec's "incomplete: unchanged" rule for a first payment that expires, and keeps an old cancelled subscription from overwriting a newer one. A new live subscription replaces the tracked one.
- `plan_code` comes from the Stripe price through `subscription_plans.stripe_price_id`. An unknown price, or a plan of the other subscriber type, is an error (500, retried, visible in `subscription_events.error`).
- Scheduled downgrade: when Stripe starts billing the price of `scheduled_plan_code`, the webhook sets `plan_code` to it and clears `scheduled_plan_code`. An expired row also drops it.
- `trial_end` is written from Stripe only while Stripe is `trialing`. Otherwise the local value (NULL = launch promotion) stays.
- Terms: on `checkout.session.completed` with `consent.terms_of_service = accepted` and `metadata.terms_version`, it stores `terms_version` and `terms_accepted_at` (event time).
- A row is created from the metadata only if none exists. #616 should make this path unused.

## Contract with the parallel items

- #610 schema: uses the columns listed in the spec's data model. `subscriptions.updated_at` must be returned exactly as stored (the compare-and-set filters on it). `subscription_events` needs `stripe_event_id` unique, `type`, `processed_at`, `error`.
- #611 prices: `subscription_plans.stripe_price_id` must hold the TEST price ids, otherwise events fail with "No plan for Stripe price".
- #612 Checkout (PR #345): session and `subscription_data` metadata carry `subscription_id` (the row id), `subscriber_type`, `subscriber_id`, `plan_code` and `terms_version`; `client_reference_id` is the row id. The webhook relies on these keys. Checkout should refuse a new session when the subscriber already has a live Stripe subscription, so two live subscriptions never alternate on one row.
- #618 plan changes: schedule a downgrade with a Stripe subscription schedule whose next phase starts at `current_period_end` with the smaller price, and set `scheduled_plan_code`. Stripe switches the price at the new period and the webhook applies it locally.
- #229 / #232 Stripe dashboard: endpoint `https://ehdzafadshbaaghzdzdo.supabase.co/functions/v1/stripe-subscription-webhook`, platform account events (not Connect), the six events above. Its signing secret goes into `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`.

## Checks

- `supabase/functions/_shared/subscription-sync.test.ts`: status table, grace start and keep, stale subscriptions, downgrade, plan errors.
- `supabase/functions/stripe-subscription-webhook/contract.test.ts`: signature, duplicates, out-of-order deliveries, grace, cancellation, incomplete, downgrade, concurrent write retry, storage failure and redelivery, unknown subscriber.
- CI job `function-contracts` runs both and type-checks `index.ts`.
- Live verification (`stripe trigger` in TEST updating the row) needs #610 applied, the function deployed and the TEST endpoint secret set, each on the owner's card.

## Creating the Stripe endpoint without the dashboard

The Stripe connector is not bound to the Motion account, and the only Motion Stripe key is the `STRIPE_SECRET_KEY` secret in Supabase. `setup-subscription-webhook` (ADMIN only) uses that key to create the endpoint with the six events and returns the signing secret once. `node scripts/setup-subscription-webhook.mjs` signs in with the admin account, calls it and writes the secret straight into `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` with the Supabase CLI, without printing it. An existing endpoint is never duplicated; `--replace` deletes it and creates a new one with a new secret. A LIVE key needs `--live`, and a TEST key refuses it, like `sync-subscription-prices`.
