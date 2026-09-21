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
official BNR daily feed `https://www.bnr.ro/nbrfxrates.xml`, returns
`{ date, eur_ron_millionths }`, caches the day's rate in memory plus
`Cache-Control`, and is called by the camp form with JWT verification.
No table. EUR camp save freezes that rate on the offer; existing enrollments
are not recalculated. Deployed version is recorded after apply.

To confirm git and the remote still agree:

```bash
npx supabase link --project-ref ehdzafadshbaaghzdzdo
npx supabase migration list
```
