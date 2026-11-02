# Coach and club subscriptions (feature #609)

Status: approved by the owner on a decision card, 2026-11-02 11:38:31Z ("Aprob specificația").
Tracker: Team Tracker project 16, feature #609, plan v40 item 1284. Downstream items #610–#624, bug #1304, To-Dos #227–#232.
Analysis: https://claude.ai/artifact/D2B3yrW9XDYd7uRjBM7sTR (model A chosen by the owner on a card, 2026-11-02 10:57:36Z).

## Goal

Coaches and clubs keep signing up as today, but appearing on the marketplace and receiving new enrollments now requires a paid monthly subscription. Parents keep paying for courses, camps and activities exactly as today (Stripe Connect or cash); this spec does not change that flow.

## Out of scope

- Parent payments for offers. They stay on Stripe Connect plus cash. Card payments carry only the exact Stripe processing fee as the platform fee (see "Platform fee").
- Any purchase inside the native Android or iOS app. Subscriptions are sold and managed only on the website.
- Annual billing, coupons, referral discounts and per-coach pricing (models B and C were rejected).
- VAT. The operator is not VAT registered (see "Invoicing").

## Plans

| Code | Name shown | For | Coaches included | Price / month | Price in bani |
|---|---|---|---|---|---|
| `COACH` | Antrenor | independent coach | the coach | 100 lei | 10000 |
| `CLUB_START` | Club Start | club | up to 3 | 199 lei | 19900 |
| `CLUB` | Club | club | up to 10 | 349 lei | 34900 |
| `CLUB_PRO` | Club Pro | club | unlimited | 599 lei | 59900 |

- Prices are final amounts in RON. There is no VAT on top and no separate Stripe surcharge.
- Billing is monthly, renewing automatically, in RON only.
- The plan table in the database is the only source of prices, limits and Stripe price ids. The client never hard-codes a Stripe price id; it may display prices read from the plan table.

## Who pays: the owner of the offer

Every offer (course, activity, camp, competition) already has an owner in the schema: `club_id` when it belongs to a club, otherwise `coach_id`.

- An offer with `club_id` is covered by that club's subscription. The coaches who teach it do not pay anything for it.
- An offer with `club_id IS NULL` and a `coach_id` is the coach's own offer and is covered by that coach's `COACH` subscription.
- A coach who works only inside clubs and has no own offers never needs a subscription. Their account page says that the club covers them.
- A coach who belongs to a club and also publishes own offers pays 100 lei for the own offers. The club's offers stay covered by the club.
- Offers with neither owner (for example admin-created competitions) are exempt.
- A coach appears in the public coaches list when they have access of their own or belong to at least one club with access.

## Subscription states

One subscription row exists per subscriber (one per independent coach account, one per club). It is created as a trial when the account is created (coach) or approved (club), so every subscriber always has exactly one row.

| State | Meaning | Access |
|---|---|---|
| `trialing` | free period, no card required | yes, until the trial end |
| `active` | paid and current | yes |
| `past_due` | the last renewal failed; Stripe is retrying | yes, during the 7-day grace period |
| `canceled` | the subscriber cancelled; the period already paid continues | yes, until `current_period_end` |
| `expired` | trial ended without a plan, grace ran out, or a cancelled period ended | no |

"Access" means: listed on the public pages and able to receive new enrollments. It is computed from dates at read time by one SQL function, not only from the stored state, so a missed webhook or a missing scheduled job can never keep an account visible after its dates have passed:

- `trialing`: access while `now() < effective_trial_end`.
- `active`: access while `now() < current_period_end + 1 day` (one day of tolerance for late renewal webhooks).
- `past_due`: access while `now() < past_due_since + 7 days`.
- `canceled`: access while `now() < current_period_end`.
- `expired`: no access.

Mapping from Stripe subscription status, applied by the webhook (#613):

| Stripe | Local |
|---|---|
| `trialing` | `trialing` (trial end from Stripe) |
| `active`, `cancel_at_period_end = false` | `active` |
| `active`, `cancel_at_period_end = true` | `canceled` |
| `past_due` | `past_due` (sets `past_due_since` once, clears it on payment) |
| `canceled`, `unpaid`, `incomplete_expired` | `expired` |
| `incomplete` (first payment not completed) | unchanged; the local trial or expired state stays |

## Free period

- Launch promotion: every coach and club whose account exists before the subscription launch date gets 3 months free, counted from the launch date. The launch date is set by the owner at To-Do #232 (proposed: Friday 2026-11-06).
- After launch, a new coach account or a newly approved club gets 30 days free from creation or approval. This value is a setting, not code.
- No card is asked for during the free period. The subscriber picks a plan on the website before the trial ends; if they pay during the trial, Stripe charges first at the trial end (Checkout passes the remaining trial when it is at least 48 hours away, otherwise it charges immediately).
- A club in its trial has no coach limit. When it picks a plan, it may not pick one whose limit is below its current number of coaches.

Settings live in one row of a `subscription_settings` table:

- `launch_at timestamptz` — NULL until the owner launches. **While NULL, nothing is enforced: every coach and club keeps full access.** This is the single switch that makes deployment order safe.
- `launch_trial_days int` — 90.
- `signup_trial_days int` — 30.

A trial row created before launch stores `trial_end = NULL`, meaning "launch promotion". The effective trial end is `coalesce(trial_end, launch_at + launch_trial_days)`. A row created after launch stores a concrete `trial_end`.

## What expiry changes

When a subscriber loses access, enforced on the server (SQL and edge functions), not only in the UI:

- Their offers disappear from Cursuri, Tabere, Activități, Concursuri, the map and Acasă. The club disappears from Cluburi; the coach disappears from Antrenori unless a club with access covers them.
- Detail pages of those offers, opened from an old link by someone without an existing enrollment, show the existing "offer unavailable" state.
- New enrollments are refused on every path: `validate-enrollment`, `create-enrollment`, `create-competition-registration` and the cash option. The refusal is a 409 with code `SUBSCRIPTION_INACTIVE` and a neutral Romanian message for the parent ("Această ofertă nu primește înscrieri momentan.").

What stays unchanged:

- Existing enrollments, their payments (including paying an enrollment created before expiry and buying more sessions on an existing enrollment), attendance, announcements, live location and history.
- Parents keep seeing their children's offers in their account.
- The coach or club keeps full access to their own panel: they can edit offers, mark attendance and post announcements. New offers they create are saved but stay hidden until access returns.
- Regaining access (paying again) makes everything visible again immediately. Nothing is deleted.

## Club coach limits

- The limit counts rows in `club_coaches` for the club, including managed coaches. Pending invitation codes do not count.
- At the limit, `redeem-coach-invitation`, `register-coach` with a club code and `create-managed-coach` refuse with 409 `COACH_LIMIT_REACHED` and a message asking the club to choose a larger plan. The check and the insert run in one transaction, so two parallel redemptions cannot both pass at 3/3.
- Upgrade: immediate, Stripe prorates and charges the difference at once.
- Downgrade: takes effect at the end of the current period, and only when the club's current number of coaches fits the new limit. The club page explains how many coaches must be removed first. No coach is ever removed automatically.
- Plan changes go through our own edge function from the club page (#618). The Stripe Customer Portal is configured without plan switching, so it cannot bypass the limit rule.

## Selling only on the website

Google Play treats a coach or club subscription as business software that must use Google Play Billing when bought in the app. Apple is similar. We therefore keep every path to buying out of the native apps:

- In the native build (`Capacitor.isNativePlatform()`): no price, no plan name with price, no "Plătește"/"Abonează-te" button, no link or text that sends the user to pay on the website. The `/preturi` page, the subscription pages and the subscription banners are not routed. A subscriber without access sees only a neutral status line, for example "Profilul tău nu apare acum în căutare.", with no link and no instruction to pay elsewhere.
- Registration screens in the native app do not mention prices.
- The subscription edge functions accept only browser requests whose `Origin` is `https://motionromania.ro`, `https://www.motionromania.ro`, `https://master--motiontimisoara.netlify.app`, `https://deploy-preview-<n>--motiontimisoara.netlify.app`, or `http://localhost:<port>` / `http://127.0.0.1:<port>` (with an explicit port). A missing `Origin`, `https://localhost` and `capacitor://localhost` are refused with 403.
- Emails may link to the website, because they are read outside the app.

## Stripe Billing design

- Stripe Billing on the platform account (the same Stripe account that runs Connect). Subscription money goes to the platform, not to connected accounts.
- One Stripe customer per subscriber, created once and stored on the subscription row; metadata `subscriber_type` and `subscriber_id`.
- Checkout in `mode=subscription`, `locale=ro`, `currency=ron`, billing address required, `consent_collection.terms_of_service=required`. The accepted terms version is stored on the subscription row.
- Customer Portal: update card, cancel at period end, see payment history. No plan switching, no immediate cancellation.
- Retry schedule (owner sets it in the dashboard, To-Do #229): Smart Retries within 7 days, then cancel the subscription. This matches the 7-day grace period above.
- Stripe's own customer emails for failed payments and receipts are turned off; we send Romanian emails (#623) and the fiscal invoice (#622).
- The webhook is a separate endpoint and secret from the enrollment webhook. It verifies the signature, records each event id once, and on every event re-reads the subscription from the Stripe API before writing, so events delivered twice or out of order converge to Stripe's current state.

## Data model (detail for #610)

Migration `00107` (check the ledger first; 00106 is the last committed).

- `subscription_plans`: `id uuid` PK, `code text unique` (the four codes above), `subscriber_type text check ('COACH','CLUB')`, `name text`, `price_bani integer > 0`, `coach_limit integer NULL` (NULL = unlimited), `stripe_price_id text NULL`, `active boolean`, `created_at timestamptz`. Readable by everyone (public pricing page); written only by service role or migrations.
- `subscription_settings`: single row as described in "Free period".
- `subscriptions`: `id uuid` PK; `subscriber_type`; `coach_user_id uuid NULL references profiles(id) on delete cascade`; `club_id uuid NULL references clubs(id) on delete cascade`; check exactly one of the two matches `subscriber_type`; unique per subscriber; `plan_code text NULL references subscription_plans(code)`; `scheduled_plan_code text NULL` (downgrade at period end); `status`; `trial_end timestamptz NULL`; `current_period_end timestamptz NULL`; `past_due_since timestamptz NULL`; `cancel_at_period_end boolean`; `stripe_customer_id text unique NULL`; `stripe_subscription_id text unique NULL`; `terms_version text NULL`; `terms_accepted_at timestamptz NULL`; `created_at`, `updated_at timestamptz`.
- `subscription_events`: `stripe_event_id text` unique, `type`, `received_at`, `processed_at`, `error`; service role only.
- `subscription_adjustments`: admin free extensions with `admin_user_id`, `subscription_id`, `days`, `reason`, `created_at`; insert only through a server function, readable by ADMIN.
- RLS: a coach reads their own row, a club owner reads their club's row, ADMIN reads all; nobody writes from the client. Writes only from edge functions with the service role.
- `public.subscriber_has_access(club_id uuid, coach_user_id uuid) returns boolean`, stable, implementing the access rules and the `launch_at IS NULL` switch; plus `public.offer_has_access(club_id, coach_id)` that applies "the owner pays". Public listing queries and enrollment functions use these.
- Deleting a coach or club account must cancel the Stripe subscription first (immediately, no refund) and then delete; the row cascades.

## Platform fee

Amended 2026-11-02 after three owner decisions on cards:

- 15:17:26Z, "Reținem exact costul Stripe din plată": the platform fee on a parent card payment is exactly the Stripe processing fee of that payment. It replaces 1 RON + 3.5%, for subscribers and during trials alike. The platform earns nothing on payments; its revenue is the subscription.
- 15:29:12Z, "Săptămânal, lunea": coach and club Express accounts pay out weekly on Mondays.
- 15:53:34Z, "A. Trei cifre": the coach and club dashboards show the online payments of the current month in three figures.

### Exact Stripe fee

- Payments stay destination charges, so Stripe charges its fee to the platform balance.
- At creation the application fee is the ceiling for the most expensive card: 3.15% + 1 RON, plus 2% for currency conversion, capped at the amount.
- When the charge's balance transaction is available, the webhook reads its `fee` and refunds the difference between the application fee and that fee through an application fee refund. The recipient then receives the amount minus exactly the Stripe fee.
- The payment row stores `stripe_fee_amount` (bani, from the balance transaction) next to `platform_fee_amount` and `coach_payout_amount`, which are updated after the refund.
- If the balance transaction is not available, the payment keeps the ceiling and a retry job settles it. A settled payment is never settled twice (idempotent on the charge id).
- Connect account fees (10 RON per active account per month, 0.25% + 1.50 RON per payout) stay with the platform and are not passed on.
- Feature #636.

### Payout schedule

- `settings.payouts.schedule` is `interval: weekly`, `weekly_anchor: monday` when a coach or club Express account is created in `stripe-connect`.
- Existing connected accounts are updated once through a script; that Stripe write needs the owner's card.
- Romania settles in 3 business days (7 for the first payout), so a Monday payout carries the payments settled by then.
- Feature #636.

### Dashboard figures

- `/coach` and `/club` show a card "Plăți online în <month>" with: collected from parents, Stripe fee withheld (negative), and net received (primary accent). It also shows the count of successful card payments so far this month and a note that the fee is withheld from each payment and that the subscription is paid separately. The subscription note is hidden in native builds (store compliance).
- The data covers successful card payments for offers the coach owns (or the club's offers for a club), read through an `src/api` function under RLS.
- States: loading skeleton, error with retry, zero payments as an empty message, Stripe not configured as the existing "Plăți cu cardul" card.
- Payment-level detail stays on the card payments page.
- Prototype captures: `/mnt/project-files/verificari/cost-stripe-dashboard/` (variant A). Feature #640.

- The 19% VAT that the code adds on top of the fee is removed (bug #1304), because the operator is not VAT registered. The rate stays a single named constant set to 0, so it can change if the company registers for VAT.

## Invoicing

- Operator and issuer of every subscription invoice: TITUS CLUB SWIM&FUN S.R.L., CUI 49252540, J35/4752/2023, Ghiroda, Timiș. ANAF on 2026-11-02: not VAT registered, so invoices carry no VAT and the mention required for non-VAT payers. Re-check the ANAF status before launch and before any price change.
- Stripe receipts are not fiscal invoices. Every paid Stripe invoice produces one invoice in the chosen invoicing program (SmartBill or Oblio, To-Do #228), sent to e-Factura, with the PDF available on the subscription page.
- Billing details (person or company name, CUI when a company or PFA, address) are collected before the first payment and stored server-side.
- If the company becomes VAT registered, prices are not changed automatically; the owner decides and the terms announce it at least 30 days ahead.

## Acceptance criteria per downstream item

Each item is done only when its own criteria pass and are recorded in Team Tracker. Production writes, migrations, edge deploys and live Stripe changes always need the owner's card for that exact operation.

### #610 Schema
1. Migration 00107 creates the tables, settings row, the four plans (prices 10000/19900/34900/59900, limits NULL/3/10/NULL) and the access functions described above, with UUID PKs, `timestamptz`, explicit FK deletion and RLS on every table.
2. Isolated SQL tests prove, per role (anon, parent, coach, other coach, club owner, other club, admin): who can read which subscription row; that no client role can insert, update or delete in any subscription table; and that plans are publicly readable.
3. SQL tests for `subscriber_has_access` cover every state at the boundary second, `launch_at IS NULL`, the launch promotion and the club-covers-coach rule.
4. `database.types.ts` regenerated and `supabase/migrations/README.md` updated; applied to production only after the owner's card.

### #611 Stripe prices
1. A repeatable script creates (or finds, idempotently) the four products and monthly RON prices in Stripe TEST, with lookup keys equal to the plan codes, and writes the price ids into `subscription_plans`.
2. Running it twice creates nothing new. The same script, with the live key, is used at #232.
3. No price id appears in client code.

### #612 Checkout and Customer Portal
1. `create-subscription-checkout` requires a session, re-reads the live profile role, accepts only plans of the caller's subscriber type, creates the Stripe customer once and returns a Checkout URL with the trial rule, terms consent and allowed return URL.
2. A club cannot start Checkout for a plan below its current coach count; an expired coach can subscribe again.
3. `billing-portal` returns a portal session only for the subscription's owner.
4. Both refuse native or unknown origins (403), parents, anon users and other subscribers.
5. Contract tests cover wrong role, unknown plan, existing customer, below-limit plan, origin refusal.

### #613 Webhook
1. Separate function and signing secret; invalid signature returns 400 and writes nothing.
2. Handles `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`, applying the status mapping and `past_due_since` rules.
3. The same event twice changes nothing the second time; events out of order end in Stripe's current state (contract tests for both).
4. A scheduled downgrade is applied when the new period starts.

### #614 Access rules
1. With `launch_at` set and a subscriber without access, none of their offers appear in any public list, map or home section, and the club or coach disappears from Cluburi or Antrenori (except coaches covered by a club).
2. Every new-enrollment path returns 409 `SUBSCRIPTION_INACTIVE`; existing enrollments can still be paid, topped up and attended.
3. With `launch_at` NULL nothing changes compared with today (regression tests).
4. SQL or contract tests for every enrollment path and every public list.

### #615 Coach limit
1. Club Start accepts the 3rd coach and refuses the 4th; Club accepts the 10th and refuses the 11th; Pro has no limit; trials have no limit.
2. All three entry paths (invitation redemption, registration with a club code, managed coach) enforce it transactionally.
3. A downgrade below the current coach count is refused with the number of coaches to remove.

### #616 Free period
1. Every coach account and every approved club without a row gets a `trialing` row (launch promotion), and new coaches and newly approved clubs get one automatically.
2. Before the production write: the owner sees the counts to be written; after it: counts before and after match the plan.
3. After launch, new rows get `signup_trial_days`.

### #617 Coach subscription page (web)
1. Shows state (trial with days left, active with next charge date, past due with the grace end date, cancelled with end date, expired), price, "Alege abonamentul" (Checkout) and "Gestionează abonamentul" (Portal).
2. A coach without own offers who belongs to a club sees that the club covers them and no payment button.
3. Dashboard banner 14 days before the trial ends and while past due.
4. Not routed in the native build. Design system, consistency with the other account pages, loading/error/empty states, 375 and 1440, both themes, owner's design verdict.

### #618 Club subscription page (web)
1. Shows the three plans with coaches used / limit, the current plan, upgrade (immediate) and downgrade (end of period, refused below the coach count), Portal link and a warning at the limit.
2. Same platform, design and verdict rules as #617.

### #619 Public pricing page `/preturi`
1. Coach 100 lei and the three club plans with what each includes, the launch promotion, "fără TVA" note with the operator name, FAQ (cancellation, what happens at expiry, club coaches covered).
2. Linked from the coach and club registration pages on the web only.
3. Not routed and not linked in the native build. 375, 768, 1440, both themes, consistency with Despre/Contact, owner's verdict.

### #620 Admin panel
1. List of all subscriptions with search and filters (state, type, plan) using the existing filter bar pattern; estimated monthly revenue from active paid subscriptions.
2. "Prelungire gratuită" with a required reason, through a server function that logs to `subscription_adjustments`; for a Stripe subscription it moves Stripe's trial end so no charge happens before the new date.
3. Only ADMIN can open the page or call the function. 1440 and 375.

### #621 Native app without prices or payment links
1. An automated search of the built native bundle finds no price strings, subscription routes, Checkout or Portal calls.
2. On an Android phone with the release build, coach and club accounts with and without access see no price, button or link to pay; parents pay for offers as before.
3. Subscription functions refuse native requests (covered by #612). This item unblocks Google Play (#225) together with #231.

### #622 e-Factura invoices
1. One invoice per paid Stripe invoice, idempotent on the Stripe invoice id, issued by TITUS CLUB SWIM&FUN S.R.L. without VAT, sent to e-Factura, PDF on the subscription page.
2. Failures are retried and alert the admin; no payment ends up without an invoice.
3. Billing details are required before the first Checkout.

### #623 Emails
1. Romanian emails from the Motion România sender: trial ends in 14 and 3 days, payment failed, subscription expired, cancellation confirmed, payment confirmed with the invoice.
2. Links point to motionromania.ro. Each email is sent once per event (idempotent).
3. Real sending only with authorization; tested on the test accounts.

### #624 Terms
1. New subscription section in `/termeni`: prices, monthly automatic renewal, cancellation any time from the Portal effective at the end of the period, no partial refunds, what happens at expiry, the 30-day notice for price changes, who issues invoices. Billing data added to `/confidentialitate`.
2. New terms version and SHA-256 in `supabase/functions/_shared/terms-version.ts`; the legal sections in Team Tracker get new evidence and the owner's verdict.
3. Checkout requires acceptance; the accepted version is stored. Lawyer review recommended before launch.

### Bug #1304 Platform fee VAT
1. `VAT_RATE` is 0; a 320 lei payment gives a fee of 12.20 lei and 307.80 lei to the recipient (today 14.52 lei and 305.48 lei).
2. Tests and any UI text mentioning VAT on the fee are updated. Edge deploy after the owner's card.

### To-Dos #227–#232
- #227 (owner): the accountant confirms the CAEN code, VAT threshold handling, e-Factura for PFA and companies, and B2C invoices for coaches without a PFA.
- #228 (owner): invoicing program chosen and its API key stored as a Supabase secret.
- #229 (owner): Stripe Billing and Customer Portal enabled in TEST (portal without plan switching), retry schedule of 7 days then cancel, Stripe customer emails off, statement descriptor "Motion România".
- #230: the end-to-end scenario on master-- in Stripe TEST covers every state in this spec, the limits, the club cover, invoices, emails, admin extension, role refusals and the native bundle search, with proven cleanup.
- #231: Android phone check as in #621.
- #232: launch: migration, functions, live prices and webhook, backfill, `launch_at` set, publish; each step on its own card; verified on motionromania.ro.

## Release order

1. #610 schema (with `launch_at` NULL, so nothing is enforced) and #1304.
2. #611, #612, #613, #615, #616 and #614 can ship in any order behind the NULL switch.
3. Web pages #617–#620 and native #621.
4. #622–#624 and the end-to-end test #230, #231.
5. #232 sets `launch_at`, which turns enforcement on.

## Decisions made in this spec (confirmed by the owner, 2026-11-02 11:38:31Z)

- Grace period after a failed renewal: 7 days.
- After launch, new accounts get 30 days free (the launch promotion is 3 months).
- A coach inside a club pays 100 lei only for own offers outside the club.
- A club cannot downgrade, or pick at trial end, a plan smaller than its current number of coaches.
- Club trials start at admin approval, not at registration.
