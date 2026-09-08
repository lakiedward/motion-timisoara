# Feature #315: local enrollment pricing checkpoint

## Scope

The September 8 delivery plan continues the already merged camp age-pricing model and editor. This checkpoint changes the enrollment contract and checkout summary. It prepares a server-only RPC permission migration and a reviewable PR. It does not apply remote migrations, deploy functions, publish a release, finish public camp pricing, or mark feature #315 complete.

## Behavior

- The authenticated parent must own every selected child. Invalid, duplicate, missing and foreign IDs cannot result in partial enrollment.
- Both enrollment endpoints obtain camp prices from `pret_tabara_pentru_copil`, which uses completed years at the camp start date and inclusive age intervals. No matching category is an explicit refusal; an RPC failure never falls back to `camps.price`.
- Validation returns each eligible child's amount in bani, currency and an opaque price version. Checkout uses those amounts for its existing child rows and total. Missing camp prices block progression, including with an older deployed endpoint.
- Creation recalculates on the server and compares the selected price versions before writing. The client supplies no authoritative amount. A changed quote asks the parent to review the refreshed details.
- Existing successful or refunded payments cannot be rewritten. An existing Stripe intent keeps its stored amount and currency; unpaid rows without an intent may be repriced using a conditional update that fails if their payment state changes concurrently.
- All selected prices and existing payment states are checked before the first enrollment write. Database read/write errors are explicit failures. Existing cross-request capacity and multi-row transaction limitations remain release risks; this checkpoint does not claim full transactional enrollment.

## Design and organization

Preserve the accepted checkout layout, canonical primitives and current tokens. Extract the existing payment finalization and form controls so authored files stay below 600 lines. Do not introduce a new public pricing design. The stable checkout section identity remains `motion-react:page:/account/checkout:section:toata-pagina`.

## Live inspection

On September 8, the product RPC is SECURITY DEFINER and executable by anon and authenticated as well as service_role. It does not validate child ownership itself. RLS is enabled on children, camp_age_prices, enrollments and payments. Prepare migration 00041 to revoke client execution and retain service_role execution; unchanged signatures require no generated type changes.

## Verification and delivery

1. Local SQL: actual existing price functions, age boundaries and birthday, single price, missing category, and denied RPC execution for anon/authenticated after the migration.
2. Endpoint contract tests: distinct amounts, malformed/missing/foreign children, RPC failure, changed quote, pending payment retries, successful/refunded payments and concurrent state changes.
3. Checkout tests and simulated browser journey from a camp to checkout at 1440x900, 768x1024 and 375x812: different child prices, refusal, single price, missing/changed quotes, and intact existing payment behavior. Label simulation evidence explicitly; no real account creation, enrollment or charge.
4. App typecheck, lint, full tests with four workers and production build; edge type checks and tests; final diff review and clean Cursor Bugbot verdict.
5. Leave the checkpoint reviewable. Full live integration, public pricing, deployment approval and the human UI acceptance remain outstanding for #315.
