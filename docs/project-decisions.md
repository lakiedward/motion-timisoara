# Project decisions

These dated decisions were moved from the former CLAUDE.md to preserve project context. They are historical records, not live release status. Read the linked specs, current code and tracker before changing the relevant behavior. Later entries supersede earlier decisions where explicitly stated.

Append-only: `- YYYY-MM-DD — decision — reason`. Preserve operating knowledge when
reorganizing this document; correct obsolete facts with current evidence.

- 2026-09-08 — Adopt the 11-section `/proiect-nou` documentation contract and an exact
  `AGENTS.md` mirror — all agents should receive the same project rules and learned notes.
- 2026-09-08 — Retain `motiontimisoaraApp/`, `motion-react`, `master`, current token names,
  Radix/Sonner/Lucide and feature folders during documentation adoption — this existing
  product must keep its code contracts, visual precedent and tracker identities.
- 2026-09-08 — Record missing template infrastructure explicitly in section 11 — a
  Markdown update cannot install a rule suite, migrate tokens or annotate rendered UI.

- 2026-09-09 — Feature #319 uses the official Capacitor barcode scanner with the
  bundled ZXing Android decoder and iOS SPM; the owner approved Android 8 minimum.
  Camera access is declared on both platforms. Native camera proof and human
  device approval remain separate from browser rendering.
- 2026-09-09 — Attendance mutations go through `record-attendance` and its
  service-only transaction. Direct authenticated writes to `attendance` are revoked.
  Request receipts and per-child/session accounting prevent duplicate debits and
  protect manual corrections from delayed QR scans. Historical attendance receives
  no invented debit or refund. Run `pwsh -NoProfile -File
  supabase/tests/run-transactional-attendance.ps1` and `npx --yes deno test --no-lock
  supabase/functions/record-attendance-contract.test.ts` for the isolated contracts.

- 2026-09-09 — Feature #320 uses session-scoped Edge reads after empty private
  Realtime invalidations, with no coordinate Broadcast/history. Native capture uses
  pinned Capgo 8.4.5 plus a reproducible expiry/cleanup patch; never remove that patch
  without replacing the lifecycle guarantees. The implementation and outstanding
  migration, UI and device gates are documented in
  `docs/superpowers/specs/2026-09-09-feature-320-live-location-app.md`.

- 2026-09-10 — Feature #320 camp sharing starts only through an explicit coach action
  and appears in parent Announcements. The owner selected eight hours per start,
  clamped to the camp end in Europe/Bucharest. Attendance is confirmed once on arrival;
  departure or cancellation removes access. Camp migrations remain proposals until
  individually approved. The owner waived physical iPhone testing for #320; preserve
  iOS build/simulator checks and do not report physical iPhone behavior as verified.

- 2026-09-10 — The owner approved and deployed #320 camp migrations 00045–00047
  and `coach-live-location` v2 with JWT verification; their remote versions are in
  `supabase/migrations/README.md`. Camp participation remains service-only. Losing
  the last eligible child automatically revokes parent consent; another eligible
  child preserves it. Temporary camp fixtures were authorized for Android/parent
  verification and cleanup. Deployment does not imply final human acceptance.

- 2026-09-10 — The owner removed mandatory bot review gates from Team Tracker skills.
  Use the available review method before merge; unavailable bot integrations do not
  block delivery. Behavioral verification, human acceptance and actual merge/deploy
  requirements remain in place.

- 2026-09-15 — Feature #326 sends data-only FCM messages through a custom Android
  service that validates the current account binding before display. The parent opts
  in explicitly; local revocation precedes auth changes. Firebase tasks stay serialized
  across response timeouts. The private outbox rechecks sessions and audiences before
  sending. Keep `android/app/google-services.json` untracked and the sender credential
  only in Supabase secrets. iOS/APNs remains deferred. See the Android push and backend
  specs dated 2026-09-15 for contracts and verification.

- 2026-09-15 — Feature #327 uses an app-local Capacitor Android bridge around
  Stripe Android 22.8.1 and Play Services Wallet 19.4.0. Native payments accept
  TEST configuration only, disable Link and retain the existing web Elements adapter.
  Every child keeps one frozen RON payment; explicit recovery reuses its original
  intent, while webhooks alone fulfill sessions. Initial enrollment batches use
  service-only atomic persistence. See the feature #327 specs and verification record.

- 2026-09-16 — To-Do #150 keeps native `type="date"` for camp start/end, grouped as
  one Perioada taberei fieldset with inclusive duration and 7/8/14-day shortcuts.
  A JavaScript calendar would replace Capacitor's platform pickers; no new date
  library. Club, coach, and admin create/edit (`/club/camps`, `/coach/camps`,
  `/admin/camps`) share that fieldset. See
  `docs/superpowers/specs/2026-09-16-todo-150-camp-interval.md`.

- 2026-09-17 — To-Do #158 requires weekday+hours on course create/edit. The program
  is stored as `{daySchedules}` JSON on `courses.recurrence_rule` (Monday=1 …
  Sunday=7). Native `type="time"`; no implicit days or hours. After save, the next
  eight weeks of `course_occurrences` are generated in Europe/Bucharest. Future
  sessions with attendance are kept; other future sessions follow the new program.
  Coach and club forms share `CourseProgramFields`. See
  `docs/superpowers/specs/2026-09-17-todo-158-course-program.md`.

- 2026-09-17 — To-Do #159 stage 1 draft is a local three-step camp form
  (Detalii, Categorii și costuri, Verificare). Category totals are the sum of
  named components; there is no competing global camp price. See
  `docs/superpowers/specs/2026-09-17-todo-159-camp-form-draft.md`.
- 2026-09-17 — To-Do #159 live save persists named components on
  `camp_age_prices.components`, always `by_age`, `camps.price` 0, empty
  `camp_price_items`. Existing enrollments are not recalculated. Templates
  stay later. See
  `docs/superpowers/specs/2026-09-17-todo-159-camp-form-live-save.md`.
- 2026-09-21 — To-Do #159 organizer camp list cards for `by_age` read
  `camp_age_prices`: category count and min–max of category totals, using the
  same en dash as the period on that card. Amount 0 is Gratuit. Legacy
  single-price cards still use `camps.price` and `camp_price_items`.
- 2026-09-21 — To-Do #159 camp, course and activity EUR rates are BNR
  automatic, not typed. Organizer forms show `Curs BNR din <date>: <rate>
  lei/EUR` from Edge Function `bnr-rate` (`https://curs.bnr.ro/nbrfxrates.xml`,
  integer millionths, in-memory + Cache-Control for the day, JWT). A missing
  feed blocks EUR save. Frozen on the offer at save; existing enrollments
  unchanged.
- 2026-09-21 — To-Do #160 camp rules files use public bucket `camp-rules`
  (same access model as `camp-photos`: public camp pages, no listing, owner
  write path-scoped). One file per camp, 10 MB, PDF / images / Word / Excel.
  Metadata is on `camps`; `save_camp_offer` does not touch it. See
  `docs/superpowers/specs/2026-09-21-todo-160-camp-rules-file.md`.
- 2026-09-22 — To-Do #160 rules files also cover courses and activities, one
  file each, with the same PDF, image, Word, Excel and 10 MB limits as camps.
  Public buckets `course-rules` and `activity-rules` use `getPublicUrl`.
  A club may change only the activity file columns. Migration
  `00066_course_activity_rules_file.sql`. See
  `docs/superpowers/specs/2026-09-22-todo-160-course-activity-rules-file.md`.
- 2026-09-22 — A club creates and edits its activities with the same full form
  as its courses, including the one rules file, and picks the coach from its
  roster. The activity column guard is removed. INSERT and UPDATE follow the
  course policies. Migration `00067_club_activity_management.sql`.
- 2026-09-22 — To-Do #153 slice is a public competition presentation: name,
  description, and an optional hero. Club, coach, and admin create it the same
  way they create camps. A saved row is public immediately. GPX, age categories,
  enrollment, payments, and podium stay later. Migration
  `00069_competitions.sql`. See
  `docs/superpowers/specs/2026-09-22-todo-153-competitions-skeleton.md`.
- 2026-09-22 — To-Do #159 stage 2 camp templates are owner-scoped snapshots.
  They copy currency, age categories, components, description, rules text,
  packing list, cash, location and capacity. Title, slug, period, rules file,
  photos, coaches and the BNR rate stay on the edition. The same template name
  replaces that owner's snapshot. Selection is only on create and asks before
  overwriting a started form. Migration `00070_camp_templates.sql`, applied
  once as remote `20260922172538` (`camp_templates`). See
  `docs/superpowers/specs/2026-09-22-todo-159-camp-templates.md`.
- 2026-09-22 — To-Do #152 a parent can enroll themselves as an adult camp
  participant. Dedicated `camp_adult_prices` sits next to age categories, with
  the same named components, total, RON/EUR and Gratuit-at-0 rules. An enrolled
  adult occupies one seat from `camps.capacity`. Courses and activities stay
  child-only. Migration `00068_camp_adult_enrollment.sql`. See
  `docs/superpowers/specs/2026-09-22-todo-152-adult-camp-enrollment.md`.
- 2026-09-24 — The public activities list (`/activitati`) keeps only activities
  whose Europe/Bucharest end time is still ahead, nearest first. The detail
  page stays available on a direct link. Card photo is the activity photo,
  then the sport photo, then a Lucide icon. Remaining seats use
  `activity_spots_remaining` (capacity minus PENDING and ACTIVE enrollments;
  NULL capacity stays unlimited). Migration `00076_activity_spots_remaining.sql`,
  applied once as remote `20260924141924` (`activity_spots_remaining`).
- 2026-09-25 — The shared page wash is `--page`, six percent of `--primary`
  mixed into `--background`. `--background` stays white because the header,
  fields, and sheets use it; `--card` stays the content surface. `--accent`
  is the hover color, so the page does not use it. Dark mode keeps the
  existing dark canvas. The wash is a flat color on `html`, `body`, and the
  native shell. No pattern, photo, or motion.
- 2026-09-25 — The page wash stays, and three soft shapes sit on it: two
  circles and one arc, drawn from `--primary` at low opacity, fixed to the
  viewport and not repeated. Opaque page fills on the portal and the native
  shell are removed so the same field shows on every screen. Cards and the
  scrolled header stay on `--background` / `--card`. No pattern, photo, or
  motion.
- 2026-09-28 — Activity, course, camp, and competition hero photos are required
  in the coach or club form. Save does not proceed without one. The public
  hero band is that photo. The gallery stays a separate requirement. The empty
  gradient is not the hero. Migration `00077_club_activity_hero_photo.sql`
  lets a club upload an activity hero. It was applied once on 2026-09-28 as
  remote `20260928094434` (`club_activity_hero_photo`).
- 2026-09-28 — Activity, camp, and competition public heroes use the course
  frame. The photo fills the band and the title sits on it in white. Sport
  and level chips stay on the course page.

- 2026-09-30 — Bug #1092 uses official `@capacitor/keyboard` pinned to 8.0.5 with
  Native resize. Bootstrap restores visible iOS accessory arrows and Done before
  rendering forms. The native shell owns a bounded DOM content scroller with bars
  in flow; outer WKWebView scrolling is disabled only while that shell is mounted.
  This is a candidate pending installed iOS keyboard verification; browser geometry
  and a build do not prove native focus behavior. See
  `docs/superpowers/specs/2026-09-30-bug-1092-ios-keyboard.md`.

- 2026-09-30 — The installed #1092 candidate `9cc365f` retained header safety but
  failed offscreen field traversal/reveal and keyboard landscape space. The second
  candidate keeps outer pan protection, releases bottom tabs only for a visible
  software keyboard, compacts the landscape header to the existing h-11 scale and
  reveals active/adjacent form fields inside main after actual geometry/content
  changes. Native accessory arrows/Done and focus ownership remain unchanged.
  The installed second-candidate result remains a separate verification gate.

- 2026-09-30 — Installed #1092 candidate `402fb29` passed Login portrait,
  Coaches, Recovery and header/landscape-space safety, but Register's second
  portrait Down and Login/Register landscape traversal still failed. The third
  candidate prepares all form centers that fit before expanding field rectangles.
  Login/Register opt into labeled two/four-column fields within max-w-3xl only
  during native keyboard landscape; ordinary portrait/web spacing stays canonical.
  Labels, errors, DOM order, input sizes, Back and native accessories remain intact.
  Cached accessory eligibility is inferred; installed exact-SHA retest is required.

- 2026-10-05 — The owner authorized rotating the four existing `uiaudit` account
  passwords and persisting them in a local Windows DPAPI store, with reusable helper
  code at `C:\Users\lakie\.codex\tools\motion-test-access` — future authorized UI
  checks should reuse saved credentials while verifying the live profile role; account
  creation, role changes and business mutations retain their separate consent boundaries.

- 2026-10-07 — Replace the byte-identical instruction mirror with AGENTS.md as the shared source and a CLAUDE.md @AGENTS.md import — follow the owner's new guide, reduce always-loaded context and keep occasional procedures in docs/agent-workflows.md. This supersedes the 2026-09-08 mirror contract; no byte-comparison mirror test is required. Existing product and human-gate rules remain in force.
- 2026-10-07 — Location types share 24 Romanian choices across club/coach forms and list badges, grouped by pools/water, courts/tracks, halls and outdoor places — the owner requested many usable choices at the final form review; retain existing POOL/TRACK/GYM/OTHER values and enforce the expanded whitelist in PostgreSQL.
