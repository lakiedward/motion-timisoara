# Geocoding verification — bug 1143

## Local revision and checks

Branch `codex/fix-bug-1143-geocoding-reliability`, based on master `6604b481e0d0b9502c1e01e0c688353b20231765`. The final implementation diff was reviewed in the current local session for address parsing, request cancellation, cache isolation, role checks, service-only grants and preservation of exact selected coordinates. No unresolved actionable finding remained. The international-search false match discovered in Chrome was corrected by retaining the typed query and using coordinates as a ranking preference.

On 2026-10-08, application checks passed in order: `npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=4` (177 files, 1646 tests), `npm run build`. The earlier unconstrained Windows test run hit one 5-second UI-test timeout under CPU contention; the file passed alone and both subsequent complete runs with four workers passed. Build warnings remain for the existing large bundle and mixed static/dynamic Capacitor imports; lint produced no warnings.

Backend verification passed: seven Deno contract tests, Deno entrypoint type checking, isolated PostgreSQL RLS/grant/cache/cooldown/stale-token assertions, and concurrent connections granting exactly one lease. CI contains these contracts. Generated database types were refreshed and compared unchanged after migration 00085 (apart from normalizing the final newline).

## Deployed backend

- Product project: `ehdzafadshbaaghzdzdo`.
- Migration 00084: remote `20261008080147`, `location_reverse_cache`.
- Migration 00085: remote `20261008083235`, `location_reverse_provider`.
- Function `location-reverse`: ACTIVE v4, JWT verification enabled, bundle SHA-256 `25b2a2a1e10e71a3b6e8a71e664ed00a32b76446a20c789f87df714c31a1f30b`.
- Live RPC permissions: anon/authenticated denied, service_role permitted. Both tables have RLS and no client policies/grants by design. Existing unrelated advisor findings were not changed.
- Nominatim returned HTTP 403 from Supabase Edge and is not used by the final adapter. The independent Photon provider is explicitly offered for public use by its operator; it remains configurable/disableable on the server.

## Real Chrome evidence

Authenticated CLUB session; local URL `http://127.0.0.1:3017/club/locations/new`. Only the primary host's reverse URL was blocked through the test tab's documented DevTools capability. Address search remained live. Successful backend HTTP 200 responses contained real provider data; no mocked coordinates or responses were injected.

| Viewport | Scenario | Result |
|---|---|---|
| 1440 × 900 | Timișoara click, primary reverse blocked | `Intrarea Ormos Zsigmond`, Timișoara, Timiș; fallback about 2.2 seconds |
| 1440 × 900 | Search Zell am See, select town, click street, primary reverse blocked | `Weißgerbergasse 3`, Zell am See, Salzburg; about 0.9 seconds |
| 768 × 1024 | Search Radstadt after Zell am See, select town, click Kranabethweg, primary reverse blocked | `Kranabethweg 5`, Radstadt, Salzburg; about 0.8 seconds, no horizontal overflow |
| 375 × 812 | Select another Radstadt street point with primary reverse blocked | `Kranabethweg`, Radstadt, Salzburg; no stale house number and no horizontal overflow |
| 375 × 812 | Existing `Bazin Audit Motion` edit form, primary restored, click Timișoara map | `Bulevardul Republicii 12A`, Timișoara, Timiș; save enabled after completion |
| 768 × 1024 and 1440 × 900 | Same completed edit form | County/city/address visible with established layout |

Edit URL: `http://127.0.0.1:3017/club/locations/f11ef72e-8114-48bc-bf4d-6cbee7897985/edit`. No create/update/delete location action was submitted. Test-tab request blocking was removed. Chrome application error log was empty at the end of these checks. Cancellation/manual-edit/late-response behavior is covered by the component and API tests.

Local captures are in `C:/Users/lakie/AppData/Local/Temp/motion-geocoding-1143/`: `local-zell-1440.png`, `local-radstadt-768.png`, `local-radstadt-375.png`, `local-edit-375.png`, `local-edit-768.png`, `local-edit-1440.png`. These are static UI evidence, not a video. A continuous recorder with cursor/click capture is not exposed by the permitted tools, so review-video delivery remains open. No physical Android/iOS runtime was exercised by these browser checks.

## Delivery boundary

At this pre-PR checkpoint, the backend is deployed and the new web client is verified locally. Merge, public deployment SHA/browser checks and canonical UI inventory synchronization are separate remaining delivery steps. A town centroid may have no street; selecting a real mapped street fills only address components present in the source data. If both services fail, the bounded error/retry/manual-completion path remains available.
