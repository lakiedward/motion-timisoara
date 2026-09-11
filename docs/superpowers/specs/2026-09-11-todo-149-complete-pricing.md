# To-Do #149: complete RON/EUR pricing

## Scope and authorization

The owner requested completion of the entire To-Do after PR #76. This supersedes the first slice's no-deployment boundary. Complete organizer forms, all offer displays, parent confirmation, payment/session fulfillment, isolated and live verification, authorized deployment and final UI acceptance. Keep the tracker open until these requirements are proved. No real card charge is authorized.

## Product behavior

Use one currency selector for course (coach and club), activity and camp forms. RON is the existing default. EUR requires the organizer's positive rate, up to six decimal places. Changing currency reinterprets the entered source amount; explain that it does not automatically convert it. Camp breakdown and age tariffs inherit the selected currency and rate. Preserve source currency on read/edit/save.

Display offer amounts in their selected currency on public, coach, club and admin surfaces. EUR offers also explain that payment is in RON at the displayed organizer rate. Payment history always displays the saved payment currency and accepted conversion when available.

Checkout obtains per-child authoritative RON quotes for every kind and selected course package. The details and final summary show the source amount, rate and exact payable RON amount. Bind acceptance to the quoted versions and quantities; changed offers require a fresh explicit confirmation. Persist and reuse accepted snapshots; never calculate a payable price from public offer fields.

Credit course sessions from the accepted snapshot quantity, never from a later offer price. Card webhook and authorized cash confirmation must perform payment completion and session credit exactly once in one database transaction. Failed/stale Stripe events must not reverse a confirmed payment. Existing gateway intents must be checked and reused or cancelled safely; uncertain gateway errors must not create a second charge.

## Delivery and evidence checklist

- [ ] Forms preserve and validate source currency/rate across create/edit for all organizer paths, including single/age camp prices.
- [ ] All public and management price displays use the saved currency; parent checkout displays the RON total before acceptance and payment.
- [ ] Exact conversion, stale versions, package changes, ownership, cash/card retries, concurrency and session credits have meaningful automated tests.
- [x] Proposed migrations run in isolated PostgreSQL with security and idempotency checks, then apply with live post-write verification.
- [x] Generated database types match the actual deployed schema.
- [ ] Browser scenarios at 1440x900, 768x1024 and 375x812 cover organizer saving, public rendering, parent quote confirmation and cash/card outcomes.
- [ ] Relevant native runtime checks and genuine Stripe test-mode evidence are recorded without claiming physical iOS or live charges that did not occur.
- [ ] Typecheck, lint, app tests, build, final diff review and CI pass.
- [ ] Owner accepts the visible behavior; merge and required deployment are verified before tracker completion.

Existing UI Coverage launch gates for the whole application remain human-owned. Completion of this To-Do does not declare the entire app ready for production. Test fixture and credential cleanup must be recorded; never put secrets in tracked files or logs.

## Implementation evidence, 2026-09-11

Migrations 00048–00054 are applied. The migration ledger contains remote versions
and live privilege checks. Pricing snapshots are immutable, payment completion is
atomic, cancellation preserves accepted/gateway-bound drafts and camp quotes read
currency, rate and age tariff together. Generated types match the deployed schema.

The first Stripe request is persisted before contacting the gateway. Retries reuse
its original email, Connect destination and fees. An unbound request older than
23 hours requires reconciliation instead of risking duplicate creation after the
idempotency window. Sixteen mocked intent tests cover lost responses, failed binding,
changed inputs, concurrent calls and retry states. Payment/enrollment handler suites
passed 89 combined cases. Isolated SQL covers exact pricing, authorization, rollback
and concurrent confirmation without duplicate session credits.

Camp metadata, currency, rate, breakdown and age tariffs now save together through
save_camp_offer. The form keeps its generated UUID for retry after uncertain responses.
Eleven form tests pass, including retry identity, exact EUR values and RON switching.
SQL proves no orphan after failed creation, repeated creation with one identity,
metadata rollback on failed pricing and foreign-owner refusal.

Independent backend and frontend review found three relevant issues: mutable Stripe
request parameters, inaccessible saved course packages different from ten sessions,
and partial camp creation. All three are fixed and re-reviewed without open findings.
The package selector is accessible before child selection; the refusal message names
the saved session quantity. Reviewer assessment is static, supplemented by executed
local tests and live camp browser/SQL checks; it is not actual Stripe payment proof.

App typecheck and lint pass; 722 tests across 75 files and production build pass.
Build warnings concern
large chunks and mixed static/dynamic Capacitor imports. No check:rules command exists.

Playwright pricing simulations passed 33 scenarios. EUR CAMP, COURSE and ACTIVITY
journeys verify source/rate details, authoritative RON totals, confirmation and payment
history at 1440x900, 768x1024 and 375x812. Tests also cover changed quote acceptance,
package changes and resuming a five-session offer from child selection. These are
explicit simulated backend/cash flows; all external calls were intercepted. Captures
and console/network assertions are in test-results/checkout-pricing.

Live preview browser proof on port 3017 used the audit club session. A disposable
camp was created with EUR 123.45 and rate 5.123456, changed to RON (SQL confirmed
price 12345 and null rate), then saved atomically as EUR/by_age with a 6–16 tariff
of 99.99 EUR. The public page shows the exact saved tariff and organizer rate.
Mobile, tablet and desktop captures show readable pricing; desktop/tablet document
widths do not exceed their viewports. Public-page error console is empty. Viewport
overrides were reset afterwards.

The disposable camp id 2281fa10-095e-42a8-a92f-d706eef80cd7 remains for follow-up
checkout checks and must be cleaned up. No parent enrollment or payment was created
through the live browser during these organizer/public checks.

## Live Stripe test verification

The six current function bundles were deployed on 2026-09-11: stripe-webhook v4
(verify_jwt=false with Stripe signature validation), mark-cash-paid v4,
cancel-draft-enrollment v5, create-payment-intent v5, validate-enrollment v6 and
create-enrollment v6 (verify_jwt=true). The local ignored .env.local now contains
the Motion test publishable key. No key values are tracked.

An authenticated audit-parent API journey used temporary course
9d74e418-7ac6-4db4-a306-03f7bdb68ac9, with 12.34 EUR per session and rate 5.123456.
Validation quoted five sessions as 31612 RON minor units; creation preserved the
accepted snapshot. Stripe intent pi_3UEVFa0lj0kEqgLX0gn8cIXP was independently read
before confirmation and verified livemode=false, amount=31612 and currency=ron.
Confirmation using Stripe's pm_card_visa test method returned succeeded and
amount_received=31612. The actual webhook activated enrollment
7a611830-ec2d-4c4c-b30b-bc5c92cc3d1e; payment
3497461e-05b5-432c-b00f-fcfa21e25858 is SUCCEEDED/RON/31612 and purchased_sessions
and remaining_sessions are both exactly five. This is real test-mode API/webhook
evidence, not a browser card-entry or native proof. No real-money charge occurred.

The temporary course is now inactive. Its test enrollment/payment remain for
browser history verification and require scoped cleanup afterward. Stripe test
objects are retained as evidence; no production payment should be altered.

## Remaining delivery gates

Additional live organizer evidence: the audit club created course
7385fa31-fc8c-4507-aff2-5bea3ae0cd48 with 12.34 EUR per session, legacy price
98.72 EUR and rate 5.123456. Create, edit, required-rate validation, RON switching
and public display were exercised; club form/public rendering was inspected at the
three target sizes. The temporary club_coaches association from club
7a43caa7-f8fe-4387-a849-3d4e59371a24 to coach profile
9fe1fb47-a3ad-4b17-8d1e-2705ec62604b was absent before this test and must be removed
after the disposable club course is removed.

With the owner's explicit authorization, only the .test audit parent and coach
passwords were reset. Both authenticated through the real Chrome login form and
were logged out successfully. No credentials are recorded here.

The .test audit coach created course a24010ba-3d43-4dcc-af9c-c1e86ddfdf5e and
activity 4f670b7a-b96f-4d79-9b08-9fe7da6edac4 through the local preview connected
to the live product database. Both EUR forms rejected an empty exchange rate and
accepted comma-decimal 5,123456. Editing reloaded the exact source amounts and rate.
Course management displayed 98.72 EUR, activity management 23.45 EUR. Switching
to RON was verified through SQL: amounts remained 9872/1234 for the course and
2345 for the activity, while eur_ron_rate_micros became null. Both offers were
then restored to EUR with rate 5.123456 for follow-up checkout verification.
Coach checks in this pass used
Chrome's existing desktop viewport; responsive and public follow-up remain pending.

PR 77 Playwright CI run 34603972770 passed. Web and Android builds passed; the
push iOS build passed while the separate PR iOS job was still running at this check.

Cleanup update: all four disposable offers listed above and the temporary
club_coaches association were removed. Before deletion, no enrollments existed for
any of these offers; course occurrences/photos/announcements/ratings and camp
photos/participation/live-location records were also absent. Post-delete SQL
confirmed zero remaining course, activity, camp and association rows. The original
fixture descriptions above remain historical evidence, not current inventory.
Fresh fixtures will be required for the remaining checkout scenarios.

The owner authenticated the existing motiontimisoara Stripe account
acct_1SMpzG0lj0kEqgLX. Chrome verified Test mode and the explicit no-real-transactions
banner. STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are now stored in the product
Supabase project's encrypted secrets. No values are recorded in this document.
The new test destination we_1UEV5s0lj0kEqgLXrE49yLe7, named Motion Supabase test
payments, targets https://ehdzafadshbaaghzdzdo.supabase.co/functions/v1/stripe-webhook
and listens to payment_intent.succeeded and payment_intent.payment_failed from the
platform account, API version 2025-09-30.clover. Existing legacy API destinations
were preserved. The successful test payment and signed webhook are recorded above.

Latest-head CI web, Android and Playwright jobs passed. iOS compiled but the native
location harness timed out before readiness. The same unchanged native source and
workflow passed in run 34603943798; only the failed iOS job of run 34606090160 was
rerun after verifying that no native/workflow diff exists since 6fbfdd1. Its retry
failed at readiness again. The artifact shows the ready event at 14:13:00.331 UTC,
after the 14:12:45 timeout. The harness now allows a bounded 180 seconds for cold
startup, then starts the separate 240-second scenario limit. Background delivery
and stop/expiry assertions retain their original deadlines. Startup timestamps
are included in evidence. Local syntax validation passed; macOS CI is required
to verify execution.

The mobile-control skill refers to MobAI, but no MobAI tools or resources are exposed
in this session. No native device proof is claimed. Existing responsive browser
proof does not establish native card behavior.

Still required: organizer browser coverage for course/activity paths, real parent
cash/card browser flows, relevant native verification,
owner UI acceptance, PR checks, merge/deployment, test fixture cleanup and tracker
completion. The current work must not be marked Gata on test counts alone.

Chrome at http://127.0.0.1:3017/account/enrollments displayed the live test payment
as Plătit, 316,12 lei, 61,70 EUR (5 × 12,34 EUR), rate 5,123456 and five sessions
remaining out of five. This desktop observation does not replace card-entry proof.
