# To-Do #153 — Complete competitions

Status: the competition schema and required Edge Functions are deployed, while the adult self-registration UI remains on PR #101. Authenticated end-to-end proof, CI for the final diff, and human UI and production acceptance remain pending. The presentation slice in `2026-09-22-todo-153-competitions-skeleton.md` remains the accepted baseline. This document records the full tracker brief and the owner's decisions in this session.

## Existing baseline

The merged skeleton provides public competition lists and details, organizer create and edit forms, a title, description, optional hero, owner authorization, and public visibility. It has no event schedule, routes, categories, enrollment, associated coaches, or results.

## Full tracker scope

- A competition has a name, description, and optional hero.
- It can have multiple routes, each with a description and GPX file. The public detail shows each route on a map and offers its GPX file for download.
- Each age category has its own route and price. A parent enrolls a child in the matching category, preserving the selected route and accepted price.
- Coaches are associated with the competition using the established camp pattern.
- After the competition, any associated coach can enter a manual podium per category. A podium candidate must be a child enrolled in that category.

## Owner decisions

- Required event fields: start date and time, end date and time, location, and registration deadline, in addition to the existing name, description, and hero. Confirmed in this session.
- Age eligibility uses the child's age on the enrollment date. Store the accepted category so a later birthday does not change the enrollment. Confirmed in this session.
- The organizer configures a registration deadline no later than the competition start. Confirmed in this session.
- Associated coaches may edit podium results after publication. The organizer publishes each category once; edits made afterward are visible publicly immediately. The owner confirmed the edit permission in this session; the publication rule is the implementation choice.
- Competition enrollment reuses Stripe and cash, and a zero-priced category enrolls without payment. Confirmed in this session.
- On 2026-09-23, the owner confirmed that an adult must also be able to enroll themself in an adult category now. They enter their birth date during competition registration. The server calculates age in Europe/Bucharest on the registration date, requires the self-registrant to be at least 18, and keeps the birth date private on the registration rather than adding it to the publicly readable profile. Child and adult registrations use the same free, cash, and Stripe payment rules. Podium candidates include either type of registered participant.

## Route presentation follow-up — 2026-09-23

The owner asked for a description and gallery on each route. Route descriptions are already required, editable, and public. Add an optional photo gallery belonging to each route, separate from the competition hero. Organizers can add up to twelve photos after saving a route, change their order, and remove them. The public detail places the gallery next to that route's description and map, using the shared photo viewer. Empty, loading, and error states remain distinct.

Store gallery metadata in `competition_route_photos` with route-scoped paths in the existing public `competition-photos` bucket. Read permission follows public competition visibility; writes follow competition organizer ownership. Delete gallery files when a route is deleted, and report failed cleanup. This follow-up does not imply that example photos exist for the two GPX routes in the local demo.

## Proposed architecture

Extend `competitions` with schedule, location, and registration deadline fields using append-only migrations. Keep route metadata and GPX storage paths in a route table, categories in a separate table referencing one route, and enrollment snapshots separate from mutable offer rows. A route needs a valid GPX before a category can accept registrations. Validate age, ownership, enrollment uniqueness, price, and podium candidate eligibility on the server. A category may publish one to three unique podium places after the event, and only its active registrants are candidates. Reuse the established coach consent and payment contracts with competition-specific authorization and fulfillment paths.

The organizer form will present schedule, routes, categories, and coaches as coherent sections using the current design tokens and shared primitives. The public detail will show route maps and download links, category terms, registration state, and published results. The parent flow will resolve child eligibility and accepted price before enrollment. Loading, error, retry, and empty states remain distinct.

## Implementation and verification order

1. Verify the live product migration ledger, the competition UI Coverage identities, and the current skeleton in the browser.
2. Add and test a bounded GPX reader for map geometry. This step does not change remote state.
3. Add the schedule, routes, categories, and storage migration with RLS, ownership checks, deletion behavior, and isolated SQL tests.
4. Build organizer and public UI, then verify responsive web and native-target rendering in the browser.
5. Add enrollment and payment persistence with immutable price snapshots and backend tests. Verify live configuration before deploying any function.
6. Add associated coaches and podium authorization, then verify the full role matrix and browser flows.
7. Run typecheck, lint, tests, build, review, and CI. Keep the UI Coverage delta on this branch until merge; update the canonical inventory after merge. Preserve the human UI verdict and production gates.

The old skeleton remains available during the migration. No tracker human-gate fields are written by this implementation.

## Local verification on 2026-09-23

- Application typecheck, lint, 1,283 Vitest tests in 142 files, and production build passed. The UI conventions document was regenerated from code after the gallery component changed the measured inventory. Regenerated database types match the applied schema; the pre-existing camp template RPC requires a local type assertion because the generator marks nullable PostgreSQL function arguments as non-nullable.
- Seven isolated Chromium simulations passed: public details at 1440×900, 768×1024, and 375×812; free parent registration; adult self-registration without children; correction of a published podium by an associated coach; and organizer editing at 375×812. The simulated backend and map tiles are explicit fixtures. Captures are written under `test-results/competition/` and are not live backend or native device proof.
- Twenty-seven focused Deno contract tests passed for competition registration, price snapshots, payment charge validation, and payment completion.
- The isolated PostgreSQL runner passed, including adult free/cash/card registrations, route gallery ownership, file paths, the twelve-photo limit, and deletion. Product migrations `00071`–`00074` were applied in order on 2026-09-23; exact remote versions are recorded in `supabase/migrations/README.md`. The live catalog has registration, podium, and route gallery tables with RLS and the expected RPCs. No real competition registration row was created during verification.
- `validate-competition-registration` and `create-competition-registration` are ACTIVE at v1; `create-payment-intent` v9, `mark-cash-paid` v6, and `stripe-webhook` v6 were redeployed with adult support. The webhook retains `verify_jwt=false`, while the other four require JWT. ACTIVE state and contract tests do not prove a real payment.
- The local Chrome mock showed two distinct GPX routes, their descriptions, and the empty gallery under each route. At 1440×900, 768×1024, and 375×812, the page had no horizontal overflow. Web builds use attributed OpenStreetMap tiles when the CARTO key is absent; native builds retain the configured CARTO source. Uploading as an authenticated organizer still needs browser verification after the schema is applied.
- Final authenticated role checks, payment confirmation, native device review, CI on the final PR diff, and human UI and production gates remain required before tracker completion. The owner explicitly waived the disabled Bugbot review for this PR and authorized the product migrations; no Team Tracker human-gate field was written.
