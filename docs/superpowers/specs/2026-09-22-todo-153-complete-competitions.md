# To-Do #153 — Complete competitions

Status: local implementation complete; integration with the product database and human UI acceptance are pending. The presentation slice in `2026-09-22-todo-153-competitions-skeleton.md` remains the accepted baseline. This document records the full tracker brief and the owner's decisions in this session.

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

- Application typecheck, lint, 1,264 Vitest tests, and production build passed. The UI conventions document was regenerated from code after the initial test run found a stale inventory.
- Six isolated Chromium simulations passed: public details at 1440×900, 768×1024, and 375×812; free parent registration; correction of a published podium by an associated coach; and organizer editing at 375×812. The simulated backend and map tiles are explicit fixtures. Captures are written under `test-results/competition/` and are not live backend or native device proof.
- Fifty-two Deno contract tests passed for competition registration, Stripe recipient selection, price snapshots, payment charge validation, and payment completion. The four affected Edge entrypoints passed `deno check`.
- The SQL migrations and PL/pgSQL blocks passed static parsing. The isolated PostgreSQL runner is pending because Docker Desktop's service is stopped. No product migration or Edge Function was applied to the remote environment, and generated database types await an applied schema.
- Final integration, authenticated role checks, payment confirmation, native device review, CI, and human UI and production gates remain required before tracker completion.
