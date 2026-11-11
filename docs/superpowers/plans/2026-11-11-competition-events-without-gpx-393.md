# Competitions without GPX routes (To-Do TT #393)

Owner decision, 2026-11-11 10:00:15Z (card, option „A. GPX opțional (probe)”): a pool-only competition must accept registrations without a fake GPX. A competition route becomes a route **or an event** („probă”); the GPX file is optional.

Analysis: project files `verificari/concursuri-fara-trasee/analiza.md`.

## Changes

| Layer | Before | After |
|---|---|---|
| Organizer form (`CompetitionOffersSection`, `competition-offers.ts`) | GPX required for a new route; categories only on routes with GPX | GPX optional; categories on any route or event |
| Quote (`_shared/competition-registration.ts`) | rejects a route without GPX | accepts it; a route that has a GPX path still needs the storage object |
| Price snapshot (`_shared/price-snapshot.ts`) | `gpxStoragePath` non-empty string | non-empty string or `null`; the price version hashes `null` exactly like PostgreSQL `jsonb_build_array(NULL)` |
| Charge check (`_shared/payment-charge.ts`) | strict compare | compares `null`-normalised paths |
| Database (migration 00139) | `gpx_storage_path_snapshot NOT NULL` + CHECK, RPC requires GPX | column nullable, CHECK allows NULL, `valid_competition_price_snapshot` accepts JSON `null`, `save_competition_registration` checks storage only when a path exists |
| Public section #3415 (`CompetitionRoutesSection`) | always map + gallery | no map for an event without GPX, gallery only when it has photos, title „Probe și categorii” when no route has a GPX |

Unchanged: `route_id` stays NOT NULL (an event is still a `competition_routes` row), age overlap rule per route, podium, RLS, grants, function signatures.

## Tradeoffs

- Reusing `competition_routes` for events keeps the data model and the payment snapshot shape (schema version 2) unchanged; a separate competition type (option B) was rejected for launch risk.
- A quote issued before the organizer adds or removes a GPX no longer matches the route and is refused with `PRICE_CHANGED`, the same rule as a replaced GPX.
- The migration refuses to run unless the live function bodies match 00072 (md5 without CR).

## Release

Migration 00139 and the redeploy of `validate-competition-registration`, `create-competition-registration`, `create-payment-intent`, `create-checkout-session` each need the owner's card. Order: migration, then edge functions, then merge (frontend). Rollback script: project files `verificari/concursuri-fara-trasee/revenire-00139.sql` (refuses if a registration without GPX exists).
