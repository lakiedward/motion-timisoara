# Switching Stripe from TEST to LIVE

Team Tracker To-Do #248 (preparation, read-only) for To-Do #232 (launch). Plan v41, 2026-11-04.

This runbook lists everything that has to change when the product stops using the Motion Stripe TEST keys, in the order it must happen. Every write in it (Stripe live, Supabase secrets, product database, Netlify, publish) needs the owner's approval of that exact step on a card. Nothing here was executed on 2026-11-04.

## Why it is one switch for both sites

`production` (motionromania.ro) and `master` (master--motiontimisoara.netlify.app) use the same Supabase project `ehdzafadshbaaghzdzdo`, so they share one `STRIPE_SECRET_KEY` and one set of webhook secrets. There is no "live on production, test on preview" state. From the moment the secret key is live, a payment on the master preview is a real payment. Both Netlify contexts must get the live publishable key in the same window, or Checkout opens with a key from the other mode.

## State on 2026-11-04 (read-only inventory)

Motion Stripe account: `acct_1SMpzG0lj0kEqgLX`. The live bundle on both sites contains `pk_test_51SMpz…` (bundle `index-CSnGPMZx.js`).

Supabase edge secrets present: `STRIPE_SECRET_KEY` (TEST), `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`. Missing: `STRIPE_CONNECT_WEBHOOK_SECRET` (the Connect webhook is not registered), `STRIPE_BILLING_PORTAL_CONFIGURATION` (optional, the default portal configuration is used), `FRONTEND_URL` (optional, the request origin is used).

Stripe ids stored in the product database, all from TEST mode:

| Where | Rows | Value |
|---|---|---|
| `coach_profiles.stripe_account_id` | 2 | `acct_1ULgDi0iT23CJu8s`, `acct_1UQ7bk22wCQmA0QU`, none enabled |
| `clubs.stripe_account_id` | 1 | `acct_1UQ7Ye0qsshpAxrq`, not enabled |
| `subscription_plans.stripe_price_id` | 4 | TEST prices `price_1UXJy…` for COACH, CLUB_START, CLUB, CLUB_PRO |
| `subscriptions` | 1 | `b484c1d1`, COACH, trialing to 2026-12-02, `sub_1UXLwu0lj0kEqgLXBp7aQd0f` (cancel at #230) |
| `payments` (CARD) | 7 | 6 SUCCEEDED with `cs_test_…` (2026-10-19), 1 PENDING `e74561fa` with `cs_test_…` (2026-11-02) |
| `payment_intent_requests` | 1 | frozen native PaymentIntent request |
| `subscription_settings.launch_at` | 1 | NULL (no enforcement) |

From the 2026-11-03 production test (`/mnt/project-files/verificari/stripe-productie/raport.md`), to re-check with the live inventory below:

- The only LIVE webhook sends to the old Railway backend `triathlonteambe-production.up.railway.app`.
- Two TEST webhooks send to `api.motiontimisoara.com`, a lost domain; Stripe reports them as failing on every event.
- Payouts of the Motion account are blocked because the representative's identity verification is overdue.
- Adaptive Pricing is on for one-off Checkout (a foreign card saw USD with a 4% conversion fee paid by the parent). It is off for subscriptions in code.

This session had no live Stripe key, so the live account was not read again on 2026-11-04.

## Code that must be deployed before the switch

| Function | Why |
|---|---|
| `stripe-connect-webhook` | It verified signatures with the synchronous `constructEvent`, which the Deno Stripe SDK cannot run (SubtleCrypto is async only), so every event would have answered 400. It now uses `constructEventAsync`, answers 503 when its secret is missing, and uses `maybeSingle()`. |
| `setup-subscription-webhook` | It now registers all three endpoints (`kind`: `subscriptions`, `payments`, `connect`, the last with `connect: true`), lists endpoints read-only (`action: "list"`) and deletes named endpoints (`action: "remove"`). A LIVE key still needs `confirmLive: true` for every write. The name is kept so the deployed function and its permissions stay the same. |
| `create-checkout-session` | Sends `adaptive_pricing: { enabled: false }`, so parents always pay in RON (owner decision, see the end). |

Deploy: `npx supabase@2.122.0 functions deploy stripe-connect-webhook setup-subscription-webhook create-checkout-session --project-ref ehdzafadshbaaghzdzdo --use-api` (owner's card). All three can go out in TEST mode, before launch day.

## Scripts

`node scripts/setup-stripe-webhooks.mjs` (renamed from `setup-subscription-webhook.mjs`) calls that function as an admin and stores each signing secret in its Supabase secret through the Supabase CLI, without printing it.

```sh
node scripts/setup-stripe-webhooks.mjs --check
node scripts/setup-stripe-webhooks.mjs --list
node scripts/setup-stripe-webhooks.mjs --kind all --replace --live
node scripts/setup-stripe-webhooks.mjs --remove we_RAILWAY --live
```

`node scripts/stripe-inventory.mjs` reads a Stripe account directly with `STRIPE_INVENTORY_KEY`: platform account and its verification requirements, webhooks (labelled Supabase function or dead host), connected accounts, subscription prices by lookup key, Customer Portal configurations, balance and recent payouts. It only sends GET requests and never prints the key. Use a restricted key with read-only rights (Stripe Dashboard, Developers, API keys, Create restricted key: Read on Webhook endpoints, Connect, Products, Prices, Customer portal, Balance, Payouts). A section the key cannot read is reported as an error and the rest still runs. Delete the key after launch.

## Preconditions the owner completes in the Stripe Dashboard (LIVE)

1. Representative identity verification done, so `payouts_enabled` is true and `requirements.past_due` is empty (check with the inventory).
2. Public business details updated for Motion România / TITUS CLUB SWIM&FUN S.R.L.: name, website `https://motionromania.ro`, support email, statement descriptor.
3. Connect platform profile completed in LIVE (required before live connected accounts can be created).
4. Billing and Customer Portal configured and saved in LIVE (To-Do #229): cancellation at period end, invoice history on, plan switching off (plan changes go through our own function, spec #609).
5. Adaptive Pricing decided (see the end of this document).

## Switch, in order (To-Do #232)

Each numbered step is one owner card. Steps 4 to 9 run in one window, without customers paying in between.

1. **Inventory.** `STRIPE_INVENTORY_KEY=rk_live_… node scripts/stripe-inventory.mjs` and save the output with the launch evidence. Confirm the preconditions above.
2. **Deploy** `stripe-connect-webhook` and `setup-subscription-webhook` from this change (TEST mode is fine).
3. **TEST cleanup.** Cancel `sub_1UXLwu0lj0kEqgLXBp7aQd0f` (To-Do #230). Remove the two dead TEST webhooks: `node scripts/setup-stripe-webhooks.mjs --list`, then `--remove we_…,we_…` with their ids.
4. **Database cleanup.** Run the SQL below through the Management API, after showing the preview counts on the card.
5. **Secret key.** The owner pastes the live secret key into Supabase, Edge Functions, Secrets, `STRIPE_SECRET_KEY`. The key never passes through chat or a cloud session.
6. **Prices.** `node scripts/sync-subscription-prices.mjs --live`. It creates the live products and prices and replaces the four TEST ids in `subscription_plans`.
7. **Webhooks.** `node scripts/setup-stripe-webhooks.mjs --kind all --replace --live`. It creates the payments, subscriptions and Connect endpoints on the live account and overwrites `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET`. Check with `--list`.
8. **Old live webhook.** `node scripts/setup-stripe-webhooks.mjs --remove we_<railway id> --live`, once the owner confirms nothing uses the Railway backend.
9. **Publishable key.** In Netlify (site `22f2a86a-422b-4fe6-a030-30b66012ebdd`), set `VITE_STRIPE_PUBLISHABLE_KEY` to the live `pk_live_…` for all deploy contexts. Rebuild `master` (free branch deploy), then publish `production` by fast-forward (one production deploy, after the owner's "Publică").
10. **Verify.** Both bundles contain `pk_live_` and no `pk_test_`. One real coach subscription of 100 lei through Checkout, webhook delivered with 200, row updated, then refunded and cancelled. One real small enrollment payment to a live connected account, with the fee settlement, then refunded. Connect onboarding of one real coach or club, and its `account.updated` delivered with 200. All webhook deliveries in the Stripe Dashboard are green.
11. `subscription_settings.launch_at` and the trial backfill (#616) belong to the launch itself, not to the key switch.

### Database cleanup (step 4)

Run as one transaction. The `select` first shows exactly what changes; the owner approves those numbers.

```sql
select
  (select count(*) from coach_profiles where stripe_account_id is not null) as coach_accounts,
  (select count(*) from clubs where stripe_account_id is not null) as club_accounts,
  (select count(*) from subscriptions where stripe_customer_id is not null or stripe_subscription_id is not null) as subscription_ids,
  (select count(*) from payments where method = 'CARD' and status in ('PENDING', 'FAILED')
     and gateway_txn_id like 'cs\_test\_%') as open_test_checkouts;

begin;
update coach_profiles
   set stripe_account_id = null, stripe_charges_enabled = false,
       stripe_payouts_enabled = false, stripe_onboarding_complete = false
 where stripe_account_id is not null;
update clubs
   set stripe_account_id = null, stripe_charges_enabled = false,
       stripe_payouts_enabled = false, stripe_onboarding_complete = false
 where stripe_account_id is not null;
update subscriptions
   set stripe_customer_id = null, stripe_subscription_id = null, cancel_at_period_end = false
 where stripe_customer_id is not null or stripe_subscription_id is not null;
update payments
   set gateway_txn_id = null, client_secret = null
 where method = 'CARD' and status in ('PENDING', 'FAILED') and gateway_txn_id like 'cs\_test\_%';
commit;
```

Why each part matters:

- `stripe-connect` returns an existing `stripe_account_id` instead of creating one, so a TEST id would make every live onboarding link fail with "No such account". Coaches and clubs connect again in LIVE.
- The subscriptions webhook and the Customer Portal look rows up by Stripe customer and subscription id; TEST ids would not resolve. Trial dates and status stay as they are; #616 sets the launch trial.
- `prepareCheckoutSession` first tries to release the previous Checkout session of a pending payment. With a TEST `cs_test_` id the live API fails and the parent gets 503. Without the id, a new live session is created.
- SUCCEEDED payments from TEST stay as history. A refund attempt on them in LIVE would fail; they belong to test enrollments and are not refunded.

## Rollback

Put the TEST secret key back in `STRIPE_SECRET_KEY`, the `pk_test_` key back in Netlify, rerun `node scripts/sync-subscription-prices.mjs` and `node scripts/setup-stripe-webhooks.mjs --kind all --replace` in TEST mode (the TEST signing secrets were overwritten in step 7), and publish again. Live connected accounts created in between keep their LIVE ids in the database and must be cleared the same way as in step 4.

## Adaptive Pricing on one-off payments (decided)

Until 2026-11-04 a parent whose card or IP was foreign saw the RON price converted into their currency, and Stripe added about 4% that the parent paid (payment 2 of the 2026-11-03 test).

The owner chose on 2026-11-04 (card, option A) to always charge in RON. `prepareCheckoutSession` now sends `adaptive_pricing: { enabled: false }`, as the subscription Checkout already did, so the Stripe page always shows the same RON amount as the site, the enrollment price snapshot and the receipt. The code setting overrides the Dashboard default, so it holds in TEST and LIVE alike.
