# Reliable map address lookup — bug 1143

## Problem and accepted scope

The map pin must populate county, locality and address. PR #134 bounded waiting but both attempts still used Photon, so a Photon outage left every field empty. On 8 October Photon recovered (public Chrome response 1.67 s), confirming that a timeout alone did not remove the dependency. The user explicitly requested completion of this fix. Existing location form design and exact selected coordinates remain the accepted scope.

## Design

- Make one nearest-object Photon reverse request, with a 1.5 s deadline, instead of searching for a house up to 1 km away before trying the same server again.
- On failure, timeout or an incomplete address, invoke the authenticated `location-reverse` Edge Function. It uses the independently operated public Photon instance at `photon.koalasec.org`, with native place names and a 3 s upstream deadline. House/street layers share one nearest-address query within 100 m; the parser never treats a venue name as a street. The client bounds the entire fallback, including auth and body parsing, to 5 s.
- Cache successful complete lookups in memory for the current session (bounded size/TTL). Backend fallback results are cached by coordinates rounded to five decimals for seven days. Neither cache changes the exact pin coordinates.
- The fallback is specific to location forms, requires a live enabled CLUB/ADMIN/COACH profile, accepts only coordinates and never accepts arbitrary upstream URLs or search strings.
- Fallback use is end-user-triggered reverse lookup only. One PostgreSQL lease conservatively serializes all app instances; it enforces at least 1.1 s after a completed upstream request before another can start. A 10 s crash lease exceeds the 3 s upstream deadline. Busy requests receive a bounded retry response; no distributed per-process limiter. This is suitable for the current low-volume demo; larger traffic requires a provisioned service and explicit capacity review.
- Two service-only RLS tables store disposable geocoding cache entries and the provider lease. Clients cannot read/write either table or execute their RPCs. There are no user/venue row changes.
- The provider URL is a server environment setting, switchable/disableable without an app update. Requests identify Motion Timișoara. Existing map OpenStreetMap attribution is retained.
- A sparse result fills only genuine available fields. Failures preserve retry/manual completion. Cancellation prevents late results overwriting a newer pin or manual edit.

## Verification

Unit coverage: provider failover, cancellation, incomplete response, cache isolation/expiry and deadlines. Backend contracts: live role checks, input validation, cache hits, provider headers, busy lease, upstream errors and release. Isolated SQL: concurrent claim exclusion, cooldown, stale-token protection, RLS/grants and cache expiry. Browser: actual successful autofill on create/edit at desktop/tablet/mobile, plus actual independent-provider success with the primary Photon host blocked in the test tab. No location save is needed. Release requires merge, green CI, deployed function/schema, demo SHA and public browser proof. Browser evidence does not prove a physical native runtime.

## Runtime decision

Nominatim was evaluated with its published caching, identification and rate-limit requirements, but returned HTTP 403 from Supabase Edge. It is not retried through another proxy. Its adapter was removed; the independent Photon operator explicitly offers public use. Migration 00084 had already been applied during verification, so append-only migration 00085 makes the provider lease name independent of the configured endpoint. Both migrations remain in the ledger. A public community endpoint has no availability guarantee; bounded failure/manual correction remain necessary when both independent services fail.

## Additional user requirement during implementation

The user requested verification outside Romania, specifically Zell am See and Radstadt. Address search must therefore allow international results. Preserve foreign regions verbatim (for Austria use the state, e.g. Salzburg), preserve town names and show them in the existing dropdowns. Label the shared field “Județ / regiune”. Search sends the text exactly as typed and uses the selected coordinates as a geographic preference, defaulting to Timișoara before any point is selected. Appending the previous locality to the query produced a false hostel match for “Zell am See” during Chrome testing, so this text rewriting was removed. Retain the Romanian county/locality catalogue for Romanian choices. Verify both Austrian towns through search and actual map clicks, including the independent reverse provider; do not silently discard non-Romanian addresses.

## Provider references

- [Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md)
- [Independent Photon operator's public-use statement](https://github.com/Freika/dawarich/discussions/693)
- [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/): evaluated before the runtime rejection; this provider is not used by the delivered fallback.
