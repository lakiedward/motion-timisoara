# Stripe subscription products and prices

Feature #611 of the coach and club subscriptions spec (`docs/superpowers/specs/2026-11-02-abonamente-antrenori-cluburi.md`).

## What it does

The edge function `sync-subscription-prices` makes the Stripe catalog match the `subscription_plans` table (migration 00107, feature #610). The table is the only source of prices: the function reads every active plan and, for each one:

1. Ensures the product `motion_sub_<code lowercase>` exists, active, named `Motion România · <plan name>`, with metadata `plan_code` and `subscriber_type`. The product id is fixed, so a rerun can never create a second product.
2. Finds the price that holds the lookup key equal to the plan code (`COACH`, `CLUB_START`, `CLUB`, `CLUB_PRO`). If it is active and is RON, monthly, `tax_behavior = inclusive` and the same amount as `price_bani`, it is reused. Otherwise a new price is created, the lookup key moves to it and the old price is archived.
3. Writes the price id into `subscription_plans.stripe_price_id` only when it differs.

A second run therefore creates and writes nothing. Prices are final amounts with no VAT on top, because TITUS CLUB SWIM&FUN S.R.L. is not VAT registered (ANAF, 2026-11-02); `inclusive` keeps the amount the customer pays fixed if Stripe Tax is ever turned on. Inactive plans are skipped. Invalid rows (bad code, non-integer or tiny amount, empty name) stop the run before any Stripe call.

The function never reads a price from client code, and the contract test fails if a Stripe price id (`price_1…`) appears anywhere under `motiontimisoaraApp/src`.

## Safety

- Only a signed-in `ADMIN` (live profile role) may call it; everyone else gets 403.
- The mode comes from the `STRIPE_SECRET_KEY` secret of the Supabase project. A test key syncs TEST. A live key is refused with 409 unless the request sends `confirmLive: true`, and `confirmLive` with a test key is also refused, so the caller always states which account it means.
- The secret key stays in Supabase; no Stripe secret is needed on a laptop or in the cloud environment.
- Existing subscriptions keep billing on an archived price. Moving them to a new price is a separate decision with the 30-day notice in the terms.

## Running it

From the repository root, with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and an admin account in the environment (`MT_SYNC_ADMIN_EMAIL`/`MT_SYNC_ADMIN_PASSWORD`, or the shared `MT_TEST_ADMIN_*`):

```sh
node scripts/sync-subscription-prices.mjs --check
node scripts/sync-subscription-prices.mjs
```

It prints the mode and one row per plan with the product, the price and what happened (`created`, `replaced`, `unchanged`, `updated`). It never prints keys or tokens and does not sign the admin out.

Order of operations:

1. Migration 00107 applied (the table with the four plans and empty `stripe_price_id`).
2. `npx supabase@2.122.0 functions deploy sync-subscription-prices --project-ref ehdzafadshbaaghzdzdo --use-api` (owner's card).
3. Run the script against TEST (writes `subscription_plans`, so owner's card), then once more to prove it changes nothing.

## Launch (To-Do #232)

The product database is shared by master-- and production, so until launch `stripe_price_id` holds the TEST ids. At launch, after the owner's card for each step: replace `STRIPE_SECRET_KEY` with the live key, then run `node scripts/sync-subscription-prices.mjs --live`. It creates the live products and prices and overwrites the TEST ids in the table. Prices in a new Stripe account always start from scratch, so the live ids differ from the TEST ids.

## Checks

```sh
deno test --no-lock --allow-read=motiontimisoaraApp/src supabase/functions/sync-subscription-prices/contract.test.ts
deno check --no-lock supabase/functions/sync-subscription-prices/index.ts
```

Both run in the App CI workflow.
