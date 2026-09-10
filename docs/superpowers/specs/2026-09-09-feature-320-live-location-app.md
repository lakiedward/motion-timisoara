# Feature #320: session location in the app

This extends the backend contract in
`2026-09-09-feature-320-live-location-backend.md`. The owner requested the remaining
work on 2026-09-09. The implementation is intended for review; source and isolated
tests do not establish deployment or approval.

## User behavior

- The actual COACH selects an active occurrence in `/coach/attendance`, accepts the
  session-specific notice, and starts sharing. ADMIN does not inherit this control.
- A persistent stop control survives navigation. It remains available during capture
  initialization. Failed cleanup remains visible across logout/account changes and
  blocks another start until it can be retried.
- `/account/attendance` lists current occurrences for the parent's active COURSE
  enrollments. Only a parent with an eligible own child, PRESENT attendance and a
  QR accounting marker can obtain coordinates, after explicit per-session consent.
- `/club/courses` lists current occurrences for the owner's courses. The server
  enforces ownership on every read. Parent consent is not required for the owning club.
- Parent consent uses the backend version/CAS contract. Revocation immediately clears
  the map. A conflicting operation refreshes metadata but never silently regrants consent.
- Current metadata discovers the session without coordinates. Private Broadcast sends
  only an empty invalidation, followed by a newly authorized Edge Function read.
  A five-second fallback handles missed delivery. Ordinary polling retains the same
  map; errors, invalidation, account changes, hidden tabs and expiry clear its point.
- A point expires from the display two minutes after capture even if a request hangs.
  A new point recenters the existing Leaflet map. Missing/failed basemap tiles show
  an explicit unavailable/retry state, using the existing CARTO/OSM basemap helper.
- `/confidentialitate` describes this feature, recipients, permissions, withdrawal,
  active-data retention, infrastructure backups and map-provider requests. It is a
  feature notice, not an assertion that the operator's complete privacy policy has
  received legal review.

## Capture and lifecycle

`@capgo/background-geolocation` is pinned at 8.4.5, compatible with the app's
Capacitor 8 dependency tree. `patch-package` 8.0.1 applies the committed native
patch during installation and fails installation if it cannot be applied.

The patch requires an expiry on both platforms, rejects native URL/header delivery,
adds native wall-clock plus monotonic expiry checks, and removes callbacks and GPS
listeners on stop. Android uses a foreground location service with a visible stop
notification. It does not restore tracking after process death/task removal.
No coordinate queue or native HTTP credential persistence is used. The adapter owns
one capture at a time and retains failed cleanup so explicit retry can reach native
stop again. iOS declares the location background mode and permission descriptions.

The controller requests a stop-only capability before starting a server session.
It holds that token only in memory, so a late start response can still be stopped
after logout without authorizing reads or restarts as the previous account. Cleanup
waits for pending initialization and retains late failures. Tokens can expire and
network requests can fail; the UI does not claim a successful stop in that case.

The controller sends at most one update every 15 seconds, without overlapping
updates or replaying failed points. Native requests use CapacitorHttp with bounded
timeouts; the CapacitorHttp bridge is enabled for background auth refresh as well.
Web uses Geolocation watchPosition and stops on hidden/pagehide. Native capture
continues only while the permitted runtime is alive. There is no promise of tracking
after force-quit, OS termination or denied permissions.

The server expiry is the frozen original occurrence end plus 15 minutes, further
clamped if the occurrence is shortened. The server rejects invalid ownership,
eligibility or expiry on each request. A native timer is defense in depth; OS/device
behavior still needs the device verification below. A client with a stale original
deadline cannot extend server access.

Capacitor's generated Swift package paths are normalized to forward slashes by the
`capacitor:sync:after` hook. This prevents Windows sync output from breaking Xcode.

## Proposed database change requiring owner approval

1. `00043_coach_live_location.sql` (already merged in PR #74, not applied remotely):
   service-only transaction and four RLS tables for current sessions, latest points,
   versioned parent consent and start replay guards. No authenticated direct table
   access. Stop cascades point/consent deletion; minute cron purges expired sessions.
2. `00044_coach_live_location_realtime.sql`: private `auth.uid()` authorization helper,
   scoped Broadcast SELECT policy, restrictive receive/anonymous/publish guards,
   and invalidations for session, consent, attendance, QR accounting and enrollment
   changes. No coordinate table enters `supabase_realtime`. Client publication and
   Presence for the location prefix are denied, without changing unrelated topics.

Realtime channel authorization can be cached for a connection. Therefore messages
contain exactly `{}`, never coordinates. A previously joined client can at most see
invalidation timing; the next Edge read rechecks current access. Broadcast infrastructure
can retain session topic/timing metadata separately from active application records.
Notification failure cannot roll back attendance or location transactions; fallback
polling remains necessary.

The canonical tracker brief requires: “Cere acordul explicit al omului pe fiecare
migrare/politică.” Each migration and its access rules must be explicitly approved
before application. `CLAUDE.md` section 2 also reserves final UI acceptance for the
human. These are separate from automatic CI and Bugbot review.

## Verification and delivery evidence

- Isolated PostgreSQL: 122 existing access/lifecycle/concurrency assertions plus
  43 Realtime authorization/notification assertions passed. Tests impersonate allowed
  and forbidden actors. The Realtime SQL harness captures `realtime.send`; it does
  not prove a deployed WebSocket channel.
- App controller/API tests cover account binding, malformed responses, stop-only
  capability after logout, throttling, no queue, expiry, stop during pending start
  and capture, failed cleanup retry and retention across account changes.
- UI tests cover parent opt-in/revoke/CAS races, identity/visibility invalidation,
  club reads, coach role/time gating and map preservation/freshness.
- Adapter tests cover permissions, native expiry arguments, callback validation,
  pending start/stop and failed cleanup retry. They mock the native bridge.
- App verification passed: typecheck, lint, 712 tests in 74 files and production build.
  Existing large-chunk/mixed Capacitor import build warnings remain. The generated
  UI conventions and byte-identical CLAUDE/AGENTS mirror were checked.
- Chromium passed nine role/viewport journeys at `http://127.0.0.1:3023`:
  375x812, 768x1024 and 1440x900. Coach consent/GPS/global stop after navigation;
  parent consent/Leaflet/private invalidation/re-read/revoke; owning club map.
  No console/page errors, unexpected API/external requests or horizontal overflow.
  This uses synthetic auth, API responses, GPS and CARTO tiles; the actual browser
  WebSocket receives simulated Phoenix messages. It is not deployed Realtime proof.
  There are 27 screenshots and nine `SIMULATED-evidence.json` reports in the ignored
  `test-results/live-location/` directory, also uploaded by the Playwright CI workflow.
- Android `assembleDebug` and `assembleDebugAndroidTest` compiled the patched Java
  with JDK 21 and SDK 36. Three tests passed on an isolated Android 36.1 emulator:
  synthetic GPS after `moveTaskToBack`, native expiry without JavaScript, no points
  after expiry/stop and rejection of an already-expired start. This exercises the
  native service, not the full app/network path.
  The final stop test extracts the real notification's `Oprește` action and sends its
  PendingIntent; the final three-test run passed in 19.101 seconds. Local transcript:
  `C:/Android/motion-native-runtime/feature320-native-final-proof.txt`.
  The native patch was also reapplied to pristine npm 8.4.5 sources and compared
  against all five changed vendor sources.
  CI builds the app's qualified `:app:assembleDebug :app:assembleDebugAndroidTest`
  targets. Unqualified tasks also build third-party Cordova library tests, whose
  unrelated Kotlin test classpath is inconsistent. No dependency override or app
  test exclusion was introduced; a clean app build passed all 277 tasks.
- The iOS simulator app compiled without signing on GitHub's macOS runner (PR #75,
  App CI run 34392889009, `ios-build`). This verifies the patched Swift/SPM build;
  it does not prove iOS background/locked-screen behavior.
  The isolated runner `tests/native-location/run-ios-location.mjs` now also checks
  synthetic foreground/background delivery, manual stop, restart, native expiry and
  expired-start rejection. It requires native console evidence of the JavaScript
  callback received before the app returns to foreground; delayed delivery after
  resume is a failure. It does not poll the asynchronously flushed Preferences plist. CI uploads
  the result and command transcript. Its runtime result is still pending and it
  cannot establish physical-device or full app/network behavior.
  The first runtime attempt (34395608072) timed out during initial simulator
  CoreLocation data migration, before the app was installed. The owned simulator
  now has a bounded ten-minute initial boot allowance.
  Run 34396898372 subsequently recorded both background JavaScript callbacks before
  foreground and native expiry before foreground (artifact 10122341840). Its final
  restart failed because the harness advanced while a simulator command was pending.
  Restart stages now require an explicit app-state handshake, with no JavaScript
  restart timers. Stop assertions follow the stopped watcher, allowing synthetic
  simulator coordinates to appear legitimately in a later explicitly started watcher.
- Read-only live inspection confirmed both location schema and Realtime policies
  absent, with no location cron. No migration, Edge deployment or real location
  collection was performed.

Reproducible commands from the root:

```powershell
pwsh -NoProfile -File supabase/tests/run-coach-live-location-realtime.ps1
npx playwright test --config playwright.location.config.ts
```

From `motiontimisoaraApp/`: `npm run typecheck`, `npm run lint`,
`npm test -- --maxWorkers=4`, `npm run build`, then `npx cap sync`.
`npm run conventions` regenerates the checked UI inventory.

## Required release checks

- Approve each proposed migration/access-policy bundle and the verified UI.
- Apply approved migrations in order, deploy `coach-live-location` with JWT verification,
  inspect live functions/RLS/cron, and regenerate database types from the actual schema.
- Configure the existing `VITE_CARTO_BASEMAP_API_KEY` at build time. It is absent from
  this checkout's local `.env`; simulated tiles do not prove the production map setup.
- Verify the full deployed Edge → database → private Broadcast → authenticated read
  path using synthetic session fixtures and allowed/forbidden identities. Verify
  revocation, cross-parent isolation and stop cleanup, then delete test fixtures.
- On Android and iOS, verify background/locked-screen updates, permission denial and
  revocation, offline/no replay, explicit stop, deadline and force-quit behavior. Android
  service instrumentation covers part of this; it does not prove the full app/network
  chain. iOS runtime needs macOS/Xcode and an iOS device or suitable simulator.
- Merge only after CI, clean Bugbot and the required human gates. Mark #320 Gata only
  after required deployment and runtime verification; do not substitute source presence.

## Authorized live verification, 2026-09-10

The owner explicitly approved migrations 00043 and 00044, Edge deployment and
temporary test fixtures. Both migrations were applied in order; their remote
versions are recorded in the migration ledger. `coach-live-location` is ACTIVE v1
with JWT verification. RLS and the absence of direct authenticated SELECT were
verified for all four location tables. The expiry cron runs every minute.
Database types were regenerated from the deployed public schema.

On the physical Galaxy A55 (Android 16), the audit coach opened
`/coach/attendance`. Past August occurrences correctly disabled consent/start;
a temporary current occurrence enabled the checkbox and start button. Initial
GPS-only capture produced no point for over two minutes. Enabling the installed
plugin's Android network fallback produced a fresh point approximately 21 seconds
after start. GPS retains priority; the plugin rejects network fixes over 300 m.
No dependency upgrade or native lifecycle patch removal was needed.

The rebuilt app was installed and tested against the live Edge/database path:

- Foreground delivery reached the server and appeared as the last-sent time in UI.
- After Home, a fresh point reached the server at 10:32:07 UTC before returning to
  the app. The server retained one latest point, not a coordinate history.
- The notification's actual `Oprește` action stopped capture. The session, point
  and consent rows were all absent afterwards.
- A second start used a short test occurrence with expiry 10:35:21 UTC. A point
  arrived in the background at 10:35:06; at 10:35:51 the session and point were gone,
  before reopening the app. The UI then reported that sharing had ended.
- Live transaction checks rejected the audit parent before QR eligibility and
  before consent, allowed reading after test consent, and rejected reading after
  revocation. Eligibility was seeded explicitly; this was not a camera QR test or
  an authenticated parent browser/Realtime test.

The phone test used real device locations after MobAI mock-location injection
failed. Coordinates were not copied into logs, repository evidence or screenshots.
The screenshot `galaxy-a55-live-location-sent.png` in the session artifact directory
shows only the coach status and last-sent time. Existing audit users, course and
child were preserved; only the temporary occurrence/enrollment and related rows
are designated for cleanup.

Current local checks: typecheck, lint, all 712 tests across 74 files, production
build and Android debug assembly passed. Existing Vite chunk-size and dynamic-import
warnings remain. The local CARTO key is now configured; its earlier absence above
is historical. No final human acceptance or merge is implied.

The owner subsequently authenticated the existing Spec Parent account in Chrome.
A second temporary enrollment used its existing test child. The live parent flow
passed at 375x812, 768x1024 and 1440x900: explicit consent, loaded CARTO tiles and
marker, fresh timestamps from the physical phone, consent withdrawal removing the
map, and server stop replacing it with the inactive-sharing message. No horizontal
page overflow was observed. CDP captured the actual binary Realtime `invalidate`
event on the session topic. The delivered payload contained a transport event `id`
and no coordinates; the application SQL passes an empty payload to Realtime.
The five-second authenticated polling fallback remains present, so timestamp
changes alone are not used as proof of Broadcast delivery.

Live transaction checks also allowed the owning club and denied another eligible
parent without its own consent. Club browser rendering, locked-screen/offline/
force-quit behavior on this physical device and human UI/device acceptance remain
separate release gates. Captured browser warnings came from MetaMask and the
existing Stripe HTTP development notice; no application error was observed during
the parent flow. Map screenshots were inspected locally and not uploaded to Tracker.

After stopping the last session, the temporary occurrence, both new enrollments,
their attendance/accounting rows and location/start records were deleted and
verified absent. Both existing children, all existing users and the course were
preserved. Neither temporary enrollment had a payment or monthly-payment row.
All GitHub checks, including Cursor Bugbot, passed on code commit d71f2a2.

## Physical Android continuation through ADB, 2026-09-10

After the owner authorized the ADB continuation, the same Galaxy A55 was connected
and authorized. Both section specifications were already human-approved in Tracker.
The installed app retained the audit coach session. A new temporary occurrence
enabled an explicit consent/start; no enrollment or child record was created.

- Locked screen: Android reported `mWakefulness=Dozing` and keyguard `showing=true`.
  A fresh point captured at 11:10:20 UTC reached the server at 11:10:20.599, while
  the phone remained locked. The location service remained foreground.
- Offline and recovery: Wi-Fi and mobile data were disabled at 11:11:03 UTC.
  At 11:12:04, the latest server point remained the 11:10:51 capture. Both original
  network settings were restored at 11:12:24. New captures at 11:12:31, 11:12:51
  and 11:13:11 reached the server. The observed recovery points were captured after
  reconnection. This sampling complements the controller's no-queue tests; it does
  not establish every intermediate callback or exercise the offline error UI.
- Force stop: `am force-stop` at 11:13:38 removed the app process and location
  service. The server's last point stayed at 11:13:31 through the 11:14:10 check.
  Relaunch did not restart the location service or show active sharing. Returning
  to attendance showed unchecked consent and no active sharing. Force stop cannot
  send an immediate remote stop: the previous point remains subject to server expiry.
- The temporary occurrence was shortened to an effective expiry of 11:14:54 UTC.
  At 11:15:03, the session and point were absent without another capture/start.
  The temporary occurrence was then deleted and its absence verified; the existing
  course was preserved. Wi-Fi and mobile data were both restored to their original
  enabled state. No coordinates were copied into evidence.

The owner entered the phone PIN directly after the lock test. The local capture
`galaxy-a55-location-after-force-stop.png` shows the inactive attendance panel.
These results close the previously unverified physical Android lock, connectivity
recovery and force-stop scenarios. They do not establish iOS physical behavior,
authenticated club browser rendering, permission revocation, offline stop retry,
or final human UI/device acceptance. No source code changed during this continuation.
