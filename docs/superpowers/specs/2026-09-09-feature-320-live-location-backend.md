# Feature #320: live location backend contract

## Scope and deployment status

This is the September 9 delivery-plan item for Team Tracker project 16, feature 320.
It prepares the backend contract and a proposed migration, tested only against
synthetic data in isolated PostgreSQL. It does not complete feature 320.

`00043_coach_live_location.sql` has NOT been applied to the product database.
`coach-live-location` has NOT been deployed. Separate owner approval of the concrete
migration and access rules is required before remote application. The UI map,
background GPS collection, new native dependencies, Realtime transport, privacy
notice and device verification remain outside this stage. No migration of generated
frontend database types is needed until this schema is approved and integrated.

The shared point is the coach's position during a course occurrence. Children do
not have accounts or tracked phones. The stop boundary is the occurrence end plus
15 minutes, as decided by the owner. Start is never implicit.

## Trust and access

The Edge Function authenticates using the existing `getUser` helper, which validates
the request token through Supabase Auth. It derives `p_actor_id` from that user and
rejects any caller-supplied identity fields. The SQL public wrapper is executable
only by `service_role`, calls a private implementation, and never grants clients a
way to impersonate another profile. Every operation checks that the profile remains
enabled and has an allowed role. ADMIN has no implicit location access.

All four tables have RLS enabled and client privileges revoked. RLS is deliberately
deny-all for direct table access; the service-only transaction is the authorization
boundary for the cross-table rule involving private QR accounting. Parent/coach/club
clients must use the authenticated Edge Function. There are no authenticated table
policies, public coordinate feeds, publication changes or Realtime channels in this
stage. Future transport must preserve per-read authorization and prompt revocation;
joining a private channel once is not sufficient proof of continuing access.

Reads allow only:

- The enabled COACH currently assigned to the course, who started this session.
- The enabled CLUB account that currently owns the course's club.
- An enabled PARENT who explicitly consented to this sharing session and owns at
  least one child with an ACTIVE COURSE enrollment in this course, a PRESENT
  attendance row for this exact occurrence, and `qr_processed = true` in the
  matching attendance accounting row.

Enrollment alone, attendance at another occurrence, manual-only PRESENT and another
parent's child never qualify. Consent is scoped to a fresh sharing-session UUID;
restarting requires a new opt-in. A parent can revoke consent even after losing
eligibility. Reads re-evaluate eligibility, ownership and expiry on every call.
Metadata-only `status` lets an eligible parent discover the session ID and their
own consent version before opting in; it never reads or returns the current point.
After eligibility is lost, an existing parent consent row still allows its owner
to retrieve only that metadata, so they can recover the current version and revoke.
It never restores location reads or permission to grant consent while ineligible.

`qr_processed` is the existing sticky proof that QR was processed for this child and
occurrence; it is not the source of the latest attendance edit. QR followed by manual
ABSENT denies access; a subsequent manual PRESENT restores it while consent and
enrollment remain valid. This follows the planned PRESENT + `qr_processed` contract
and preserves #319's duplicate/debit guarantees. Requiring a new QR after every
manual correction would be a separate change to the attendance contract.

## Request contract

POST JSON to `coach-live-location`, with the authenticated user's bearer token.
Every request includes `action` and `occurrenceId` (UUID). Extra fields are rejected.

| Action | Additional fields | Caller / effect |
| --- | --- | --- |
| `status` | None | Authorized coach/club or eligible parent discovers active session metadata, with no coordinates. Parents also receive their own `consentVersion` and `consentGranted`; an existing consent owner can recover these after eligibility loss to revoke. |
| `start` | `requestId`, `consent: true` | Assigned coach; starts within occurrence start through end + 15 minutes. Generate a new request UUID only for an explicit start action; retries reuse it. A repeated start keeps the same active session and deadline. |
| `update` | `sessionId`, `latitude`, `longitude`, `accuracy`, `capturedAt` | Assigned coach; replaces the current point only. |
| `stop` | `sessionId` | Assigned coach; deletes this session, point and parent consents. |
| `consent` | `sessionId`, `consent: boolean`, `expectedVersion` | Eligible parent opts in; false revokes their own consent. The current version must match before the change is accepted. |
| `read` | `sessionId` | Authorized reader receives the current point or null. |

Successful responses contain `success: true`, `sessionId`, and (except stop)
`expiresAt`. Read adds `location: null` or a point containing `latitude`, `longitude`,
`accuracy`, `capturedAt`, `updatedAt`. A future UI must display the capture time;
this backend does not claim the last point is continuously refreshed.

A parent obtains version 0 from `status` before their first consent operation.
Each accepted grant/revoke increments `consentVersion`; revocation retains only a
denied consent row and its version until the session closes. A delayed grant with
an earlier `expectedVersion` fails with `REQUEST_CONFLICT`, so it cannot undo a
later revocation. Clients must reload status on conflict and require a new explicit
consent action rather than automatically resubmitting a grant with the new version.

Errors use `success: false` and a stable `code`: `INVALID_REQUEST`, `UNAUTHORIZED`,
`FORBIDDEN`, `OCCURRENCE_NOT_FOUND`, `SESSION_NOT_FOUND`, `SESSION_EXPIRED`,
`CONSENT_REQUIRED`, `NOT_ELIGIBLE`, `STALE_LOCATION`, `REQUEST_CONFLICT`, or `SERVER_ERROR`. Responses
are `Cache-Control: no-store, private`; raw SQL errors and coordinates are not logged
or returned in error messages.

## Lifecycle and retention

`coach_live_location_sessions` holds one session per occurrence;
`coach_live_locations` holds at most one latest point per session;
`parent_live_location_consents` holds explicit per-parent/session opt-ins. All have
UUID primary keys and cascading foreign keys. There is no coordinate history,
attendance receipt payload, child-history entry or audit log created by this code.

`coach_live_location_starts` holds only request/session IDs, occurrence, coach and
expiry until the occurrence deadline. Its session ID deliberately has no cascading
foreign key: remembering an accepted start after stop prevents a delayed retry of
that same request from reopening sharing. It stores no coordinates. Cleanup removes
these replay guards at expiry. Starting again deliberately requires a new request ID.

Mutations serialize on an occurrence advisory lock. The original expiry is frozen
at start; extending the occurrence cannot extend an existing share. Shortening the
occurrence clamps the deadline. Inactive courses, reassignment and a disabled coach
also invalidate sharing. Old session IDs cannot update a stopped/restarted session.

Coordinates must be finite with latitude -90..90, longitude -180..180 and accuracy
0..10000 metres. Capture timestamps must include a timezone, be no earlier than
session start or two minutes ago, no more than 30 seconds in the future, and strictly
newer than the saved point. The server clock controls expiry; clients cannot supply
a deadline or server observation time.

Manual stop deletes rows transactionally. Access stops immediately at the deadline,
including before returning a point. A proposed pg_cron job runs each minute to
delete expired/invalid sessions and their dependent rows; physical deletion occurs
on the next successful run, not exactly at the deadline. Cleanup must be monitored
after a future deployment. This application-level deletion is not a claim of secure
erasure from PostgreSQL MVCC, WAL or provider backups; those retention settings must
be reviewed before collecting real location data.

## Verification

- `npx --yes deno test --no-lock supabase/functions/coach-live-location-contract.test.ts`
  covers parsing, authenticated identity binding, rejected spoofing and private responses.
- `npx --yes deno check --no-lock supabase/functions/coach-live-location/index.ts`
  checks the actual entry point and its shared authentication/CORS integration.
- `pwsh -NoProfile -File supabase/tests/run-coach-live-location.ps1` exercises real
  PostgreSQL roles, grants, QR-derived access, lifecycle, cleanup and concurrent writes
  using synthetic fixtures and a network-isolated Docker container.
- The existing attendance SQL suite remains a regression gate for QR accounting.
- The Playwright workflow runs the new Deno and SQL checks. Browser/device tests are
  required when the UI and GPS portions are implemented, not evidence from this stage.

Current access implementation was checked against the live catalog on September 9:
attendance and accounting RLS are enabled; accounting has no client policy, and
attendance retains only SELECT. No product data or schema was mutated for that check.

Local results on September 9: 122 isolated SQL assertions passed, including both
orders of concurrent stop/update; 6 location Deno tests and the 8 existing attendance
contract tests passed; the new Edge entry point passed `deno check`. Application
typecheck, lint, all 655 tests (65 files) and production build passed. Build warnings
remain for existing bundle size and mixed Capacitor imports. The existing isolated
attendance SQL suite, including concurrent QR accounting, also passed.

The location SQL runner loads the real pg_cron extension and verifies the scheduled
job definition, but disables automatic jobs during deterministic fixtures and invokes
cleanup directly. This proves the deletion function, not a deployed scheduler's
operational health. No device, Realtime transport or production test is claimed.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [Supabase Cron](https://supabase.com/docs/guides/cron).
