# To-Do #149: enrollment pricing contract, first delivery slice

## Authorized scope

Plan #102 schedules the backend foundation only. Organizers choose RON or EUR and an EUR/RON rate per offer. Stripe always collects RON. No external exchange-rate provider, UI activation, remote migration or Edge deployment belongs to this slice. To-Do #149 remains open after merge.

## Contract

- Existing price columns remain integer minor units of the offer currency. Course prices are per session; activity and camp prices are per child. Camp age categories inherit the camp currency and rate.
- `eur_ron_rate_micros` stores the organizer's rate as an integer with six decimal places: 5.123456 RON/EUR is 5123456. EUR requires a positive rate; RON requires no rate. No floating-point multiplication is used.
- Multiply the source unit amount by the requested session count, then convert the total and round half up once to integer bani. Reject unsafe integers, invalid currencies/rates/counts and overflow. No implicit EUR/RON default.
- Validation returns the source unit amount, currency, quantity, rate, final RON amount and an opaque version bound to kind, offer and child. Creation independently reads authoritative prices and requires matching versions for every selected child before writing anything.
- Persist the accepted calculation in `payments.pricing_snapshot`. New snapshots are immutable, including before a Stripe intent exists. Retries reuse that snapshot; changing a course package requires a new enrollment flow. Existing legacy payments with a gateway ID keep their stored RON amount without inventing an original EUR price/rate. Legacy unpaid payments without a gateway may acquire a current confirmed snapshot through a conditional update.
- SQL validates snapshot arithmetic/shape and prevents financial changes after acceptance. Existing RLS remains in force. Only the trusted backend can attach a snapshot. Historical rows remain null; the migration does not reinterpret their currency or amounts.
- Payment intent creation must authorize the enrollment's parent and use only the saved RON amount. This foundation does not prove a completed Stripe transaction.

## Verification and rollout limits

Use deterministic Deno tests for arithmetic and actual enrollment handlers with an in-memory transport, including all three kinds, forged amount/rate, changed offers, missing versions, retries, ownership and processed payments. Run the migration against network-isolated PostgreSQL with real constraints and roles. Run app typecheck, lint, full Vitest and build; review the final diff before merge.

No browser proof is claimed for this non-UI slice. Later work must update organizer forms, all public/parent/admin displays, checkout request/confirmation contracts, generated frontend database types and course fulfillment (currently derives session count from current course price). Deploy migration and compatible Edge/frontend/fulfillment changes together only after authorization. Existing clients do not send course/activity quote versions, so these handlers must not be deployed alone. Browser checks at 1440x900, 768x1024 and 375x812 and native/Stripe/cash verification remain outstanding.

Existing multi-child enrollment writes are not a single transaction. Capacity reservation and orphan enrollment cleanup after write failures remain existing limitations; this slice does not claim atomic batch creation.

## Local evidence, 2026-09-11

- Deno: 56 passing tests across the enrollment contract, exact conversion/version validation and authorized saved RON charge. Both CARD and CASH cover RON/EUR for COURSE, ACTIVITY and CAMP. These tests execute handlers with a simulated database transport; they do not call live Stripe or create production records.
- `deno check --no-lock` passes for validation, creation and payment-intent entrypoints.
- Network-isolated PostgreSQL: `run-enrollment-price-snapshots.ps1` applies the actual migration, verifies valid and rejected numeric cases, rate constraints on all three offer tables, legacy preservation, missing/null/malformed snapshots, payment/enrollment binding, immutable amounts and role restrictions. The container is removed in `finally`.
- App: typecheck and lint pass; Vitest passes 75 files / 718 tests with four workers; production build passes with the existing Capacitor mixed-import and large-chunk warnings. No frontend files changed.
- Independent diff review identified a cash-to-card retry that preserved financial values but skipped payment method/billing updates. Fixed with conditional metadata updates and regression tests, including concurrent payment success. Re-review found no remaining actionable findings in the approved slice. The PR records the reviewed source revision.

The initial Stripe intent lookup now rejects a mismatching amount/currency and fails closed on lookup failure. The existing cancellation helper still absorbs its own failures; full intent cancellation/idempotency and completed Stripe/cash fulfillment must be verified in the follow-up. This stage is not evidence of complete Stripe retry safety or a production release.
