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

## Remaining delivery gates

Stripe test proof awaits the owner choosing/creating the Motion account. Chrome's
switcher listed only Betora and Culcush. At the owner's request, the separate-account
form and Motion Supabase secrets page were opened. Secret names are prefilled, values
are empty. No account was created, no secret copied, and no payment submitted.

The mobile-control skill refers to MobAI, but no MobAI tools or resources are exposed
in this session. No native device proof is claimed. Existing responsive browser
proof does not establish native card behavior.

Still required: organizer browser coverage for course/activity paths, real parent
cash/card flows with coordinated function deployment, relevant native verification,
owner UI acceptance, PR checks, merge/deployment, test fixture cleanup and tracker
completion. The current work must not be marked Gata on test counts alone.
