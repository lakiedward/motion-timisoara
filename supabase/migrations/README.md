# Migrations

Applied in filename order. `00001`–`00014` were authored here first.
`00015`–`00019` were applied straight to the remote project and backfilled into git
on 2026-08-20; their SQL is byte-identical to `supabase_migrations.schema_migrations`
on the remote (verified by md5).

| File | Remote `version` | Remote `name` |
|------|------------------|---------------|
| `00015_course_spots_remaining.sql` | `20260807100932` | `course_spots_remaining` |
| `00016_sport_default_photo.sql` | `20260810095021` | `sport_default_photo` |
| `00017_course_availability.sql` | `20260810133637` | `00015_course_availability` |
| `00018_course_availability_via_spots_remaining.sql` | `20260810133739` | `00015_course_availability` |
| `00019_announcement_views.sql` | `20260811091856` | `00016_announcement_views` |
| `00020_club_announcement_audience.sql` | `20260826091059` | `club_announcement_audience` |
| `00021_club_announcement_audience_ownership.sql` | `20260826094655` | `club_announcement_audience_ownership` |
| `00022_attachments_for_club_announcements.sql` | `20260826100816` | `attachments_for_club_announcements` |
| `00023_announcement_media_access.sql` | `20260826100903` | `announcement_media_access` |
| `00024_purge_expired_media_cron.sql` | `20260827083602` | `purge_expired_media_cron` |
| `00025_camps_owner_price_items_coaches.sql` | `20260827090944` | `camps_owner_price_items_coaches` |
| `00026_camp_spots_remaining.sql` | `20260827091825` | `camp_spots_remaining` |
| `00027_camps_owner_fixes.sql` | `20260827104930` | `camps_owner_fixes` |
| `00028_camp_enrollments_and_orphan_photos.sql` | `20260827112031` | `camp_enrollments_visibility` |
| `00037_camp_age_pricing.sql` | `20260902131801` | `camp_age_pricing` |
| `00038_camp_age_pricing_trigger_fix.sql` | `20260902132543` | `camp_age_pricing_trigger_fix` |
| `00039_camp_location.sql` | `20260902134657` | `camp_location` |
| `00040_child_qr_token.sql` | `20260902141147` | `child_qr_token` |
| `00041_camp_child_price_server_only.sql` | `20260908143741` | `camp_child_price_server_only` |
| `00042_transactional_attendance.sql` | `20260908205252` | `transactional_attendance` |
| `00043_coach_live_location.sql` | `20260910102002` | `coach_live_location` |
| `00044_coach_live_location_realtime.sql` | `20260910102008` | `coach_live_location_realtime` |
| `00045_camp_live_location_access.sql` | `20260910122700` | `camp_live_location_access` |
| `00046_camp_live_location_transaction.sql` | `20260910122706` | `camp_live_location_transaction` |
| `00047_camp_live_location_discovery.sql` | `20260910122711` | `camp_live_location_discovery` |
| `00080_admin_stats.sql` | `20261002115542` | `admin_stats` |
| `00081_restrict_sport_deletion.sql` | `20261007101003` | `restrict_sport_deletion` |
| `00088_admin_stats_coach_role.sql` | `20261014075237` | `admin_stats_coach_role` |

`00017` and `00018` are both kept on purpose: `00018` replaced `00017` in production
62 seconds after it was applied, and the ledger records what actually ran.

`00043` and `00044` were applied on 2026-09-10 after the owner explicitly approved
both migrations, their access rules, the Edge deployment and temporary test data.
The `coach-live-location` Edge Function was deployed as version 1 with JWT verification.
All four location tables have RLS enabled and no direct authenticated SELECT grant;
the minute-based expiry cleanup job is active. Realtime sends empty private
invalidations, never coordinates. The app/native implementation and deployment
evidence are in `docs/superpowers/specs/2026-09-09-feature-320-live-location-app.md`.

Feature #320's camp extension adds three migrations applied on 2026-09-10 after
the owner explicitly approved all three bundles, Edge deployment and temporary
camp fixtures:

- `00045_camp_live_location_access.sql`: one-time camp arrival/departure,
  camp location targets and service-only access for authorized staff.
- `00046_camp_live_location_transaction.sql`: camp sharing with per-session consent,
  parent eligibility, replay protection and an eight-hour maximum per explicit start.
- `00047_camp_live_location_discovery.sql`: authorized active-session discovery for
  Announcements, private invalidations and camp-aware expiry/cleanup.

The remote ledger and `coach-live-location` ACTIVE version 2 with JWT verification
were checked after deployment. The extension uses typed Edge DTOs; database types
must match the deployed schema. Live Android/parent verification and fixture cleanup
are recorded in `docs/superpowers/specs/2026-09-09-feature-320-live-location-app.md`.
Migration/deployment approval does not replace final human UI/device acceptance.

**Next migration number = highest existing + 1.** Check with
`git ls-files supabase/migrations | tail -1` before creating one — do not trust a
number written down elsewhere.

### To-Do #149 database rollout

`00048_enrollment_price_snapshots.sql` is the isolated-tested EUR/RON pricing
foundation for the first slice of plan #102. The owner subsequently authorized
the complete To-Do. It was applied remotely as `20260911121324` on 2026-09-11.
It adds organizer exchange rates and immutable accepted RON payment snapshots.
Offer constraints are `NOT VALID` to preserve legacy rows with unknown currencies
or missing EUR rates; new/updated rows must comply. Audit and reconcile historical
offers before validating those constraints. The deployment inventory contained
7 RON courses, 2 RON activities and 4 RON camps, with no existing EUR offers.

`00049_atomic_camp_offer_pricing.sql` was tested against the existing camp pricing
functions in isolated PostgreSQL and applied as `20260911122634` on 2026-09-11.
It saves currency, exchange rate, base price, breakdown and age prices in one
owner-authorized transaction. Failed saves preserve the entire previous offer.
Live verification confirmed SECURITY INVOKER, authenticated execution and no
anonymous execution; the four existing camp offers remained in RON.

On 2026-09-11, the isolated SQL suites and backend review passed before applying:

| Local migration | Remote version |
| --- | --- |
| 00050_atomic_enrollment_payment_completion.sql | 20260911130522 |
| 00051_safe_legacy_draft_cancellation.sql | 20260911130525 |
| 00052_atomic_camp_enrollment_quote.sql | 20260911130528 |
| 00053_frozen_stripe_intent_requests.sql | 20260911130531 |
| 00054_atomic_camp_form_save.sql | 20260911131631 |

Live verification confirmed all four RPCs are SECURITY INVOKER, executable by
service_role and inaccessible to authenticated callers. The frozen Stripe request
table has RLS and no client access. An unbound request older than 23 hours requires
reconciliation rather than risking a second intent after Stripe idempotency expiry.
Generated application database types include these migrations.

Migration 00054 saves camp metadata and the complete offer in one transaction,
including initial creation. The form supplies a stable UUID so an uncertain response
can be retried without creating another camp. Isolated tests cover failed initial
save without an orphan, full update rollback and ownership. Independent review
passed. Live checks confirm SECURITY INVOKER, authenticated access and no anonymous
access; an audit-club save stored EUR 123.45, rate 5.123456 and a EUR 99.99 age tariff.

Do not deploy the enrollment handlers independently: course/activity quote versions,
frontend confirmation, displays and snapshot-based course fulfillment still require
the coordinated follow-up described in
`docs/superpowers/specs/2026-09-11-todo-149-eur-ron-contract.md`.

Feature #280: `00055_camp_announcement_audience.sql` was applied as
`20260914154559` (`camp_announcement_audience`) on 2026-09-14. Live readback
confirmed CAMP in both `audience_club_id` and the audience-kind constraint.
The existing ownership and enrollment policies remain unchanged. The prior
review exercised 22 isolated SQL checks for ownership, parent eligibility and
media visibility; this does not substitute for the parent-feed verification.

Feature #280: `00056_parent_announcement_feed.sql` was applied as
`20260914160121` (`parent_announcement_feed`) on 2026-09-14, after 67 isolated
SQL assertions and independent review. All three client RPCs are SECURITY
INVOKER, executable by authenticated users and inaccessible to anonymous users.
Live parent impersonation returned an empty feed and the audit parent's enrolled
course. Author insertion is tied to the authenticated user; existing authors and
announcement identities are immutable. Generated client types reflect this schema.

Feature #326: `00057_android_parent_push.sql` was applied as
`20260915092254` (`android_parent_push`) on 2026-09-15, after 80 isolated SQL
assertions, concurrent claim tests and review. The four parent RPCs derive the
caller identity; the three delivery RPCs are executable only by service_role.
All six new tables have RLS. Private queue tables intentionally have no client
policies. The authenticated SECURITY DEFINER advisor notices describe the four
explicitly guarded parent entry points, not anonymous access.

The `dispatch-push` Edge Function uses its own backend secret with JWT gateway
verification disabled. The `dispatch-parent-push` cron invokes it every minute
using Vault. A live empty dispatch returned HTTP 200 after FCM authorization;
this does not establish device delivery. Generated public types include the schema.

To-Do #154: `00058_camp_requirements.sql` was applied as
`20260915115819` (`camp_requirements`) on 2026-09-15 after the owner authorized
the migration. It adds a JSON list to camps and includes it in the existing
owner-authorized atomic camp save RPC. Anonymous execution remains revoked;
authenticated execution retains the existing ownership check. Generated
application types match the applied schema.

To-Do #154 follow-up: `00059_camp_requirement_categories.sql` was applied as
`20260915122255` (`camp_requirement_categories`) on 2026-09-15 after the owner
replaced the flat list with categories and numbered items. It converts every
existing text item to quantity one in a legacy category, then enforces the
new JSON shape. The existing camp-owner authorization and atomic save RPC
remain unchanged.

Feature #327: `00060_atomic_enrollment_creation.sql` was applied as
`20260915142234` (`atomic_enrollment_creation`) on 2026-09-15. The service-only
batch RPC saves enrollment/payment pairs atomically, serializes requests for an
offer and preserves frozen prices and compatible paid retries. Isolated SQL tests
cover rollback, ownership, concurrent retries, final-seat capacity and concurrent
payment completion. Product types were regenerated from the applied schema.
`create-enrollment` v8 and `create-payment-intent` v8 were deployed with JWT
verification retained. The intent follow-up restricts new intents to card (including
Google Pay) and safely normalizes eligible existing TEST intents without replacing
their IDs or changing amounts. Android device evidence is recorded separately.

To-Do #151: `00061_free_enrollment_fulfillment.sql` was applied as
`20260916144814` (`free_enrollment_fulfillment`) on 2026-09-16 after the owner
authorized landing the stack. It keeps the service-only batch RPC and fulfills
a confirmed 0 RON quote immediately: enrollment ACTIVE, payment SUCCEEDED
without a Stripe intent. A mixed batch still requires a card intent only for
children with amount > 0. Isolated SQL and enrollment contract tests cover the
free and mixed paths. `create-enrollment` was deployed as version 9 with JWT
verification retained; amount 0 is treated as already fulfilled.

To-Do #155: `00062_camp_rules.sql` was applied as `20260916145126` (`camp_rules`)
on 2026-09-16. It adds nullable `camps.rules` (max 8000 characters) and persists
it through `save_camp_offer` when the metadata JSON includes the `rules` key.

Client presentations: `00063_demo_source_receipts.sql` was applied as
`20260917130713` (`demo_source_receipts`) on 2026-09-17. It adds an empty
private ownership ledger for presentation preparation/reset, with RLS enabled.
Anonymous, authenticated and agent_sql access are revoked; service_role
receives only SELECT, INSERT and UPDATE. No product rows were created or
changed.

To-Do #159: `00064_camp_age_price_components.sql` was applied as
`20260917133554` (`camp_age_price_components`) on 2026-09-17 after isolated
SQL tests and owner authorization (choice A). The ledger prefix is 00064 so
it does not collide with `00063_demo_source_receipts.sql`. The remote version
and function body were not re-applied. It stores named cost components on
`camp_age_prices.components`. Existing age rows were backfilled as one
`Participare` component equal to the stored amount. Ten live age-price rows
matched the sum check after apply. `save_camp_offer` still writes `by_age`
offers atomically; component names are kept with the totals. Templates are
not part of this migration.

To-Do #159 (owner choice C, 2026-09-21): Edge Function `bnr-rate` reads the
official BNR daily XML `https://curs.bnr.ro/nbrfxrates.xml` (BNR moved the
file off `www.bnr.ro` on 2026-08-06; same `nbrfxrates.xml` EUR row), returns
`{ date, eur_ron_millionths }`, caches the day's rate in memory plus
`Cache-Control`, and is called by the camp form with JWT verification.
No table. EUR camp save freezes that rate on the offer; existing enrollments
are not recalculated. Deployed as version 1 with JWT verification on
2026-09-21; source matches this branch.

To-Do #160: `00065_camp_rules_file.sql` was applied as `20260921130941`
(`camp_rules_file`) on 2026-09-21 after isolated SQL tests and owner
authorization for this slice. It adds one optional rules file per camp (PDF,
images, Word, Excel, 10 MB) on `camps` plus public bucket `camp-rules`.
`save_camp_offer` does not write the file columns. Listing stays closed; public
pages download through the public URL, like `camp-photos`.

To-Do #160, same file on courses and activities: `00066_course_activity_rules_file.sql`
was applied as `20260922071648` (`course_activity_rules_file`) on 2026-09-22
after the isolated SQL test on PostgreSQL 16. It adds the same optional file
columns to `courses` and `activities`, public buckets `course-rules` and
`activity-rules`, and path-scoped organizer policies. A club may update an
activity it owns, and only those four columns. `00065` was not re-applied.
Listing stays closed.

To-Do #160, club activity form: `00067_club_activity_management.sql` was applied
as `20260922074443` (`club_activity_management`) on 2026-09-22 after the
isolated SQL test on PostgreSQL 16. It drops the column guard and lets a club
insert and update its activities the same way it can for courses, assigning a
roster coach. Coaches and admins keep their access. `00065` and `00066` were
not re-applied.

To-Do #152: git file `00068_camp_adult_enrollment.sql` is the complete isolated
migration (adult tariff table, XOR enrollments, snapshot/batch/offer save).
It was applied remotely on 2026-09-22 in slices because of MCP payload limits,
then a copy error in the snapshot guard was corrected to match the git file.
`00065`–`00067` were not re-applied.

| File | Remote `version` | Remote `name` |
|------|------------------|---------------|
| `00068_camp_adult_enrollment.sql` (table, RLS, XOR, policies) | `20260922112747` | `camp_adult_enrollment` |
| same file (snapshot validator, adult offer RPC) | `20260922112848` | `camp_adult_enrollment_snapshot` |
| same file (guard adult match; `IS NOT DISTINCT FROM`) | `20260922112900` | `camp_adult_enrollment_guard_fix` |
| same file (`apply_enrollment_payment_result`) | `20260922112918` | `camp_adult_enrollment_payment_result` |
| same file (`save_enrollment_batch`) | `20260922113006` | `camp_adult_enrollment_batch` |
| same file (`salveaza_pretul_adult`, `save_camp_offer`) | `20260922113039` | `camp_adult_enrollment_offer_save` |

Edge Functions after that apply: `validate-enrollment` ACTIVE v8 JWT and
`create-enrollment` ACTIVE v10 JWT.

To-Do #153 skeleton: `00069_competitions.sql` was applied as remote version
`20260922171407` (`competitions_skeleton`) on 2026-09-22. It adds
`public.competitions`, `pot_administra_concurs`, and the public bucket
`competition-photos` (owner select/insert/delete, no public listing). A
rollback probe on a subset of the constraints ran first and left no rows.
`00065`–`00068` were not re-applied. The table was empty after apply.

To-Do #159 stage 2: git file `00070_camp_templates.sql` was applied once on
2026-09-22 as `20260922172538` (`camp_templates`). It was not re-applied.
`00065`–`00069` were not re-applied.

To-Do #153 completion: git file `00071_competition_offers_and_coaches.sql` was
applied once on 2026-09-23 as `20260923093854`
(`competition_offers_and_coaches`). The remote now has the schedule fields,
routes, age categories, associated coaches, and public GPX bucket.
`00072_competition_registrations.sql` was applied on 2026-09-23 as
`20260923100151` (`competition_registrations`). It adds child and adult
registrations, server-side eligibility and offer snapshots, and payment access.
`00073_competition_podium.sql` was applied on 2026-09-23 as `20260923100211`
(`competition_podium`). It adds editable results and publication by category.

To-Do #153 route gallery: `00074_competition_route_photos.sql` was applied on
2026-09-23 as `20260923100241` (`competition_route_photos`). It adds up to 12
ordered JPEG, PNG or WebP photos per route in the public `competition-photos`
bucket, with organizer writes and a route-scoped storage path.

To-Do #153 large GPX support: `00075_competition_route_gpx_limit.sql` was applied
on 2026-09-23 as `20260923131404` (`competition_route_gpx_limit`). The public
`competition-routes` bucket now accepts GPX files up to 12 MiB, including the
10,183,045-byte Via Maior source file supplied for the demonstration contest.

After these migrations, the competition registration Edge Functions were
deployed as `validate-competition-registration` v1 and
`create-competition-registration` v1. The shared adult payment contract was
deployed in `create-payment-intent` v9, `mark-cash-paid` v6, and
`stripe-webhook` v6. All five are ACTIVE as of 2026-09-23.

Section #629 public activity cards: `00076_activity_spots_remaining.sql` was
applied once on 2026-09-24 as `20260924141924` (`activity_spots_remaining`).
It returns capacity minus PENDING and ACTIVE activity enrollments. NULL
capacity stays unlimited. Anon and authenticated may execute it; they still
cannot read `enrollments`.

Hero photos, 2026-09-28: `00077_club_activity_hero_photo.sql` was applied
once as remote `20260928094434` (`club_activity_hero_photo`). A club can
write the public `activity-photos` bucket, the same way a coach already can.

Activity ages, 2026-09-29: `00078_activity_age_range.sql` was applied once
as remote `20260929125751` (`activity_age_range`). `activities.age_from` and
`activities.age_to` are nullable integers with no default and no check, the
same shape as `courses`. Existing activity rows stay null on both columns.

Google coach invitations, 2026-10-01: `00079_atomic_coach_invitation.sql` was
applied once as remote `20261001100205` (`atomic_coach_invitation`). The
service-only transaction promotes a verified PARENT identity, creates the coach
profile and sport associations, and consumes the invitation atomically. Its
private identity helper exposes only a boolean and grants no table access to
`auth.users`. The authenticated Edge Function `redeem-coach-invitation` was
deployed ACTIVE v1 with JWT verification; `register-coach` was updated to ACTIVE
v7 and retains its anonymous entry point and optional Stripe setup.

Admin dashboard stats, verified remotely 2026-10-07: `00080_admin_stats.sql`
is already applied as version `20261002115542`, name `admin_stats`; it was not
applied again during this verification. `created_at` is outside the 00036 GRANT
on `profiles`, and PostgREST
cannot compare `current_uses < max_uses` column-to-column, so exact 7-day user
and active-unexpired invite counts need this SECURITY DEFINER `admin_stats()`
RPC (`get_my_role() = 'ADMIN'`). The client tries the RPC and falls back to
`count: exact` / `admin_users()` / invite-code rows when unavailable, capped
at `max_rows=1000` (`supabase/config.toml`). A capped fallback shows a `+`
suffix.

Admin coach count bug #1095, applied 2026-10-14 after owner approval as remote
`20261014075237` (`admin_stats_coach_role`):
`00088_admin_stats_coach_role.sql` replaces `admin_stats()` so `coaches` counts
`profiles.role = 'COACH'`, the same set `/admin/users?role=COACH` lists. Before it
the RPC counted `coach_profiles`, which also holds the admin account's coach profile
(live 2026-10-14: 16 coach profiles, 15 COACH users). The live body matched 00080
(md5 `b5db31b8916396d86f1b119e2a2ce018`) before the replacement; only the `coaches`
line changes. The client fallback counts the same set. After applying, the admin
dashboard shows 15 coaches, matching the COACH list.

Admin sports #457, applied and verified 2026-10-07: `00081_restrict_sport_deletion.sql`
replaces cascading sport references in `coach_sports` and `club_sports` with
`ON DELETE RESTRICT`. Existing course and activity references already block deletion.
Remote version is `20261007101003`, name `restrict_sport_deletion`. Isolated SQL
and concurrent-association tests passed. Live readback confirms RESTRICT on both
associations; disposable coach-only and club-only fixtures each rejected deletion
with the corresponding foreign-key constraint, retaining the sport.

The merged `create-managed-coach` source was deployed ACTIVE v7 on 2026-10-07.
All five deployed files match the source at `24d483b6c1acd7f56fc357c347c12fa6426a88d9`.
Its existing `verify_jwt=false` configuration remains because the handler authenticates
the bearer token and requires an enabled ADMIN or CLUB profile itself. Fifteen Deno
contract tests and the entrypoint type check passed. A consented disposable account
was created through the ADMIN UI and verified as confirmed, enabled COACH with a
coach profile; login reached `/coach`. No human UI acceptance or shipping gate was set.

Club location form feature #418, applied and verified 2026-10-07:
`00082_location_county.sql` adds nullable `public.locations.county` without changing
existing rows or RLS. Remote version is `20261007115343`, name `location_county`.
Database types were regenerated from the remote schema, including the previously
applied `admin_stats` RPC. The description column remains; club form writes omit it.

To confirm git and the remote still agree:

```bash
npx supabase link --project-ref ehdzafadshbaaghzdzdo
npx supabase migration list
```
- `00083_expand_location_types.sql` — applied as remote `20261007132208` (`expand_location_types`) on 2026-10-07 for feature #418. The location type CHECK now accepts 24 grouped options, retaining POOL/TRACK/GYM/OTHER. A rollback-only live assertion accepted all 24, rejected an unknown type through locations_type_check and left zero temporary rows. Types were regenerated and compared unchanged; RLS, columns and existing data are unchanged.

- `00084_location_reverse_cache.sql` — applied as `20261008080147` (`location_reverse_cache`) on 2026-10-08 for bug #1143. Adds two service-only RLS tables and invoker RPCs for seven-day reverse-geocoding cache and a global Nominatim lease/cooldown. Anonymous and authenticated table/RPC grants are revoked; service-role access and RLS were verified remotely. Local isolated SQL and concurrent-claim tests passed. Application types were regenerated. These are disposable provider/cache records; no location or profile records are changed.
- `00085_location_reverse_provider.sql` — applied as `20261008083235` (`location_reverse_provider`) on 2026-10-08 for bug #1143. Renames the lease singleton to provider-neutral `fallback` and updates the invoker RPCs, retaining RLS, grants, cache and cooldown. The evaluated Nominatim service rejected Supabase requests (HTTP 403); `location-reverse` v4 uses the independent public Photon endpoint at `photon.koalasec.org`. Deno contracts, entrypoint checking, isolated SQL and concurrent claims passed. Chrome with `photon.komoot.io/reverse` blocked returned HTTP 200 and autofilled Timișoara / Timiș / Intrarea Ormos Zsigmond through the deployed fallback in 2.2 seconds. Public application release is recorded separately.
- `00086_club_location.sql` — applied as `20261009120134` (`club_location`) on 2026-10-09 for UI sections #773 and #650, at the owner's request in the guided spec session. Adds nullable `public.clubs.county`, `lat` and `lng` with `clubs_point_check` (both coordinates or neither, within range) and grants SELECT on the three columns to anon and authenticated, matching the column grants from 00012/00035. `my_club()` returns them unchanged. Remote check: the 15 existing clubs are untouched (0 rows with a point), grants listed for both roles, and a rollback-only assertion rejected a half point and accepted a full one. Types were regenerated; only these columns changed.
- `00087_club_invitation_redemption.sql` — applied as `20261013203548` (`club_invitation_redemption`) on 2026-10-13 for bug #1146, at the owner's request ("aplică migrarea 00087 și deploy register-coach pentru #1146"). Replaces `redeem_coach_invitation` so a code that is not an admin code falls back to `club_invitation_codes`: the parent is promoted to COACH and linked in `club_coaches` in one transaction, with expiry and max uses checked under a row lock; an existing coach redeeming a club code joins that club, and a repeat by a member consumes nothing. Adds `join_club_by_invitation(text)` (SECURITY DEFINER, `auth.uid()`, coaches only, EXECUTE for authenticated only) and the service-only `private.claim_club_invitation`. Remote check: anon cannot execute the join RPC, clients cannot execute the private helper or `redeem_coach_invitation`. `register-coach` v8 deployed the same day with a preflight that accepts club codes; an unknown code still returns `INVALID_INVITATION` live. End to end with the test accounts: the CLUB account generated a one-use code, the COACH account joined "UI Audit Club TM" from its profile (code now 1/1), and a repeat reported "already a member". Types were regenerated and compared identical.
- `00089_club_assets_owner_policies.sql` — applied as `20261014075856` (`club_assets_owner_policies`) on 2026-10-14 for bug #1147, at the owner's request ("aplică migrarea 00089 club-assets pe producție pentru #1147"). Replaces the role-only `club_assets_owner_insert/update/delete` storage policies with ones bound to `my_club_ids()` on the first path segment (ADMIN keeps access) and adds `club_assets_owner_select`, so a club can delete its replaced logo or cover. Remote check: four policies, all `{authenticated}`. Live with the test accounts: the CLUB account uploaded, listed and deleted a probe file in its own folder; its upload into another club's folder and the COACH account's upload into the club folder were both refused by RLS; zero probe files remain. The bucket stays public, so display is unchanged. Isolated SQL test `supabase/tests/run-club-assets-storage.ps1`.
- `00090_course_activity_photos_owner_policies.sql` — applied as `20261014083255` (`course_activity_photos_owner_policies`) on 2026-10-14 for bug #1184, at the owner's request (decision card 08:16 and the owner's message in the project chat), through the Supabase CLI on the owner's PC. Replaces the role-only `course_photos_coach_insert/update/delete` and `activity_photos_insert/delete` storage policies with ones bound to `pot_administra_curs()` / `pot_administra_activitate()` on the first path segment (owning club, the offer's coach, or ADMIN) and adds owner SELECT policies, so a replaced hero photo can be deleted. Remote check: seven policies, all `{authenticated}`. Live with the test accounts: CLUB and COACH uploads into another coach's course and activity folders were refused by RLS and listed 0 files; read-only impersonation of the real owning coaches showed each sees its own photos and none of anyone else's. Public photo URLs still return 200. The buckets stay public, so display is unchanged. 19 orphaned activity photos under deleted activities (2026-09-29) remain, deletable only by ADMIN. Isolated SQL test `supabase/tests/run-course-activity-photos-storage.ps1`.
- `00091_club_public_email.sql` — applied as `20261014094601` (`club_public_email`) on 2026-10-14 for bug #1186, at the owner's request (decision card "Aplică tot", 08:48). Adds the generated column `public.clubs.public_email` (the email only when `public_email_consent`, otherwise NULL) and grants SELECT on it to anon and authenticated. Remote check: anon `GET /rest/v1/clubs?select=public_email` returned 200 with 15 rows, all NULL (no club has consented yet). The public club page (PR #162, merge `3e08c18`) reads only this column.
- `00092_revoke_anon_club_email.sql` — applied as `20261014094910` (`revoke_anon_club_email`) on 2026-10-14 for bug #1186, after the PR #162 frontend was live on motiontimisoara.com. Revokes anon SELECT on `public.clubs.email` and EXECUTE on `public.cheama_purge_expired_media()` from PUBLIC, anon and authenticated (the cron job runs it as postgres). Remote check: anon `select=email` now returns 401 `42501 permission denied`, `select=public_email` still 200, `/cluburi/<id>` still loads; authenticated keeps SELECT on `email` for the admin club list; neither anon nor authenticated can execute the purge function.
- `00093_admin_clubs.sql` — applied as `20261014110938` (`admin_clubs`) on 2026-10-14 for bug #1188, at the owner's request (decision card "Aprob toate 3", 11:08). Adds `public.admin_clubs()` (SECURITY DEFINER, raises 42501 unless `get_my_role()` is ADMIN; EXECUTE for authenticated only) returning id, name, city and email for the admin club list. Remote check with the test accounts: ADMIN gets 15 rows; PARENT, COACH and CLUB get 42501; anon cannot execute it. No existing read changed.
- `00094_revoke_authenticated_club_email.sql` — applied as `20261014120421` (`revoke_authenticated_club_email`) on 2026-10-14 for bug #1188, at the owner's request (same decision card as 00093), after the PR #167 frontend (merge `a426cf9`) was live on motiontimisoara.com. Revokes SELECT on `public.clubs.email` from authenticated. Remote check with the test accounts: `select=email` now returns 42501 for PARENT, COACH, CLUB and ADMIN (it already did for anon); `public_email` still returns 15 rows for everyone; the CLUB owner still sees its own email through `my_club()`; ADMIN reads the list through `admin_clubs()`. Live in Chrome at 1440 and 375: `/admin/clubs`, `/admin/codes`, `/club/profile` and `/cluburi` load with no console errors and no failed REST calls.
- `00095_child_safety_fields.sql` — applied as `20261019104214` (`child_safety_fields`) on 2026-10-19 for feature #486, at the owner's request (decision card "Aplică migrarea 00095", 10:36:53), from the owner's PC after the cloud classifier refused the apply. Adds nullable `public.children.photo_consent` (boolean; NULL means the parent has not answered yet), `pickup_persons` (text, `children_pickup_persons_length` ≤ 500) and `swim_level` (`children_swim_level_check`: `no`, `basic`, `yes`). RLS and the table-level grants are unchanged and cover the new columns. Remote check: three nullable columns and both checks present; all 17 existing children have NULL in the three columns; a probe on a temporary copy of the table accepted a valid row and rejected `swim_level = 'maybe'` and a 501-character `pickup_persons`, leaving no rows. Types were regenerated from the remote schema (this also picked up the existing `public_email` column in a function return type).
- `00096_child_health_diet.sql` — applied as `20261019105442` (`child_health_diet`) on 2026-10-19 for feature #486, after the owner approved it on a decision card (the request "Sănătate + mâncare, plecare separat", 10:46:19, then the migration card), from the owner's PC. Adds nullable `public.children.medical_notes` (text, `children_medical_notes_length` ≤ 1000) and `dietary_restrictions` (text, `children_dietary_restrictions_length` ≤ 500). RLS and the table-level grants are unchanged and cover the new columns. Remote check: two nullable text columns and both checks present; no existing child has a value; a probe on a temporary copy accepted 1000 and 500 characters and rejected 1001 and 501, leaving no rows. Regenerated types match `src/lib/database.types.ts` exactly.
- `00097_club_announcements_course_coach_read.sql` — applied as `20261020083607` (`club_announcements_course_coach_read`) on 2026-10-20 for feature #284 slice 1, after the owner approved it on a decision card ("Aplică migrarea 00097", 08:31:40), from the owner's PC after the cloud refused the apply. Replaces `club_announcements_select` with the 00021 condition plus the coach of the targeted course, for published announcements only and only when the course belongs to the announcing club; attachment and `announcement-media` storage reads follow the announcement. Remote check: one policy with the coach clause. Read-only impersonation on course announcement `92e3dc02`: the course coach now reads the announcement, its attachment row and its stored video (1/1/1, was 0/0/0), while the same coach reads 0 for the club-wide announcement `3a8e6603`; a parent with no child in the club and another club's owner still read 0; the owning club and ADMIN read 1. Isolated SQL test `supabase/tests/club-announcement-coach-read.sql` in the announcement suite. Types are unchanged (policy only).
- `00098_shared_location_guard.sql` — applied as `20261020093952` (`shared_location_guard`) on 2026-10-20, after the owner approved it on a decision card ("Aplică migrarea 00098", 09:37:02), from the owner's PC after the cloud refused the apply. Adds the `BEFORE UPDATE OR DELETE` trigger `locations_shared_guard` on `public.locations` with `SECURITY DEFINER` function `guard_shared_location()` (no EXECUTE for anon/authenticated). A non-admin caller can no longer deactivate, delete, or change `address`/`city`/`county`/`lat`/`lng` of a location that a course, activity, camp or competition of another organizer references. ADMIN and calls without a user are unaffected. The error carries HINT `shared_location_guard`, which the club/coach location pages show. Remote check: function source md5 matches the file; trigger enabled. A rolled-back probe as the owner of Club Audit Motion deactivating "Bazin Audit Motion" was blocked naming "Antrenor Spec 504, Demo Coach"; the row stayed active. Isolated SQL test `supabase/tests/shared-location-guard.sql` (CI job `location-guard-sql`). Types are unchanged (trigger only).
- `00099_parent_camp_participation_read.sql` — applied as `20261021092753` (`parent_camp_participation_read`) on 2026-10-21 for feature #493 slice 1, after the owner approved it on a decision card ("A + aplică migrarea 00099", 09:26:40), from a cloud thread through the Supabase MCP. Adds `public.get_my_children_camp_attendance()` (SECURITY DEFINER, STABLE, `search_path = ''`; EXECUTE for authenticated only) returning the camp arrival/departure rows of the caller's own children with the camp title and period. `camp_participation` keeps its 00045 service-only grants. Remote check: function source md5 `c94715d9ed8e04dbe55c62f63a8f95c9`; anon cannot execute it; neither anon nor authenticated can select the table. A rolled-back probe inserted one arrival for a real camp enrollment: the child's parent read 1 row, another parent 0, and a direct table read as authenticated was denied; the table still has 0 rows. Regenerated types match `src/lib/database.types.ts`.
