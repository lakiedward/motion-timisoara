# Feature #315 checkpoint verification

This is local checkpoint evidence, not a production release or native-device acceptance.

## Automated checks

- App: `npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=4` (562 tests across 58 files), and `npm run build`.
- Edge: `npx --yes deno check --no-lock supabase/functions/validate-enrollment/index.ts supabase/functions/create-enrollment/index.ts` and `npx --yes deno test --no-lock supabase/functions/enrollment-contract.test.ts` (19 contract tests).
- SQL: `pwsh -NoProfile -File supabase/tests/run-camp-child-pricing.ps1`. The isolated container loads the original functions from migration 00037 and applies 00041 twice. Eight price cases, ownership/RLS exposure baseline, effective privileges and actual denied client calls pass. The runner waits for TCP readiness after database initialization and removes its own container.
- Browser: `npm run test:checkout-pricing` builds a dedicated preview at `http://127.0.0.1:3022`, runs 11 Chromium scenarios and saves screenshots/network-console records in `test-results/checkout-pricing`. CI uploads that directory with the Playwright report.
- The documentation mirror is byte-identical. No authored source exceeds 600 lines. Generated UI conventions were regenerated without increasing the allowed drift ceilings.

The build retains existing warnings for mixed Capacitor static/dynamic imports and chunks larger than 500 kB. `check:rules` remains unimplemented and is not reported as passing.

## Browser observations

All auth, Supabase, pricing, enrollment and Stripe responses are explicitly simulated. The suite forbids unexpected API calls and outgoing external requests; it creates no real accounts, enrollments or payments.

At 1440x900, 768x1024 and 375x812, the journey starts on the public simulated camp, follows its enrollment link to `/account/checkout?kind=CAMP&slug=test-315`, selects two children, reviews details, accepts terms and completes the CASH scenario. Individual prices are 600 and 800 RON; the total is 1,400 RON. Requests contain price versions and no client-authoritative amounts. The layout has no horizontal page overflow. Captures are named `SIMULATED-age-pricing-details.png` and `SIMULATED-cash-payment.png`.

Additional scenarios cover a single camp price, an ineligible child, missing quotes, an older backend, offer/child-list errors followed by retry, and a changed server quote that returns to details and requires acceptance again. Background quote refresh preserves cached amounts and existing acceptance while the server still validates price versions on creation. Successful journeys report no unexpected console/page errors, API calls or external requests; injected 409/503 responses are separately recorded.

## Remaining delivery gates

The PR is a reviewable checkpoint. Migration 00041 is not applied remotely and the Edge Functions are not deployed by this work. Full public category pricing and the authenticated child's category highlight remain unfinished. Real parent integration, Stripe confirmation, native-device behavior, human UI acceptance and production release verification remain outstanding.

Checkout UI Coverage identities are preserved. Sections 521 and 714 need their code references and verification refreshed when the integration is accepted; no human verdict, approval timestamp, shipped timestamp or launch-stage field is written by the agent. Feature #315 remains open.

Existing enrollment capacity races and the lack of a transaction across multiple enrollment/payment rows are not resolved by the per-payment conditional update. Missing/foreign children, invalid quotes and pricing failures are rejected before the first write, but this is not a claim of atomic batch enrollment.
