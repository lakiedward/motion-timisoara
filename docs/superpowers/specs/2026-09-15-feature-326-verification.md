# Feature 326 verification

The approved stage covers Android parent notifications. iOS/APNs and frontend/store
publication are deferred. The owner approved the card's appearance, copy and merge
after successful verification on 2026-09-15.

## Automated verification

- Public database types regenerated after the live migration.
- Application typecheck, ESLint, 986 Vitest tests and production build passed.
- The final coordinator cleanup fence is included in that run; its 21 focused tests pass.
- Android Java compilation and 20 unit tests pass, including deadline response races.
- 80 isolated PostgreSQL assertions pass, including concurrent SKIP LOCKED claims,
  audience/session isolation, revocation before registration, retries, first course
  publication and retention.
- 13 Deno dispatcher/FCM contract tests, type checking, lint and formatting pass.
- The CLAUDE.md/AGENTS.md mirror is byte-identical. The repository's pending
  check:rules adoption is not reported as an installed or passing check.

Build warnings concern the existing large bundle and the existing mixed static/dynamic
Capacitor core import in galerie.ts. ESLint emitted no warnings.

## Browser verification

Chrome, through accessibility actions and screenshots; no Playwright or CDP.

- `http://127.0.0.1:3026/?scenario=disabled`, 375x812: the actual PushSettingsCard
  component and canonical CSS/fonts, with isolated native/auth mocks. The page is
  explicitly labelled `Date simulate · #326`. Explanation and action are readable
  without horizontal clipping. Activate shows a disabled pending action, then the
  enabled state with global-account opt-out wording.
- `?scenario=error`: Reincearca shows pending feedback and recovers to disabled.
- `?scenario=denied`: Android settings instructions and retry remain visible.
- `?scenario=loading`: canonical skeleton and loading status, without claiming enabled
  or disabled before the request completes.
- `?scenario=disable-error&theme=dark`: local stop versus pending account preference is
  explicit; dark-theme error text and retry remain readable.
- `http://127.0.0.1:3017/account`, real owner session with the authorized disposable
  fixture: 1440x900, 768x1024 and 375x812. One child and one active enrollment render;
  Android-only controls are absent on web. Existing navigation and child link render.
- No application console errors observed. Chrome's MetaMask extension generated its
  own warnings; the real local app also emitted Stripe's expected HTTP development
  warning. Neither is notification delivery evidence.

The visual harness lives in the ignored `motiontimisoaraApp/tmp/push326-visual/` folder.
It neither calls Supabase/FCM nor enables a production test mode.

## Live backend verification

Migration `00057_android_parent_push.sql` was applied to product project
`ehdzafadshbaaghzdzdo` as `20260915092254`. All six new tables have RLS. Private
tables intentionally expose no client policies. The four parent RPCs reject anonymous
callers; the three delivery RPCs are service-role-only. Each function has a fixed empty
search path. The advisor's authenticated SECURITY DEFINER notices describe these
intentional guarded parent entry points; they are covered by caller/session tests.

The dedicated FCM sender has only the approved Firebase Cloud Messaging API Admin
role in `motion-timisoara`. Its credential and the dispatch secret are Supabase Edge
secrets, with the matching dispatcher secret in Vault. Temporary downloaded credential
files were removed after successful configuration; google-services.json remains ignored.

`dispatch-push` is deployed. The active per-minute cron returned HTTP 200 with an empty
queue after Google OAuth authorization. A GET returns 405 and an unauthenticated POST
returns 401. Empty dispatch proves configuration and execution, not phone delivery.

## Native verification and cleanup

Device: Galaxy A55 5G (SM-A556B), Android 16, 1080x2340, controlled through MobAI.
The owner authorized temporary records in Club Audit Motion and notifications only to
their account on this phone. No payment was performed. The final debug APK, including
the offline request fix and without temporary diagnostic probes, has SHA256
`90AB97883CA3863D79C95CB6BD8140CB71A993CDBBD4F9A05ACEC1BBF6F1368A`.

Observed on 2026-09-15, Europe/Bucharest:

- Explicit activation registered one device for the owner. Login alone did not show
  a notification permission prompt.
- Foreground attendance: a generic Motion toast displayed the updated attendance
  message. Tapping Deschide opened the attendance screen with the current temporary
  record. MobAI's native accessibility tree omitted the transient Sonner toast;
  screenshots and the successful tap proved display and navigation. Temporary native
  and React probes confirmed receipt, parsing and display, then were removed without
  changing product behavior.
- Background course: activating the temporary course produced an Android notification;
  tapping it opened that course's details.
- Normal task dismissal: Motion was swiped out of Recents, without Android Force stop.
  A new camp notification arrived and opened the correct camp detail screen. This
  proves the dismissed-task path, not delivery after an explicit operating-system
  Force stop or an independently measured process kill.
- Background club announcement: the notification opened the parent's announcements
  feed, including the authorized course-targeted test announcement.
- Account opt-out: the card changed to disabled, the backend preference became false
  and active device count became zero. A subsequent attendance event expanded with
  zero deliveries.
- Android permission refusal: after disabling the OS permission, activation showed
  the actual Android prompt. Don't allow left the card disabled with Android settings
  instructions and no active backend device. Restoring the permission in Settings and
  explicitly activating again registered a new binding successfully.
- Logout removed the active backend binding before the anonymous navigation rendered.
- Account switch: the audit coach signed in through the actual Android password form
  and saw the coach dashboard. The owner's next attendance event expanded with zero
  deliveries. After coach logout, the owner's Google login returned to the parent
  dashboard with notifications disabled until explicit reactivation created a new binding.
- Duplicate delivery: an attendance alert appeared while Motion was in the background.
  After dismissing that exact alert, the same delivery was retried against the same
  event and binding. FCM accepted both attempts; the dismissed alert did not reappear.
- Offline resume exposed a paused TanStack preference query. The fix makes those reads
  run offline and bounds session retrieval and RPCs to ten seconds each, including
  time spent waiting for Supabase auth before fetch. On the final APK, Flight mode with
  Wi-Fi off produced the existing error and Reincearca action instead of indefinite
  loading. Reconnection restored the enabled state. A new background attendance alert
  then opened the current record, and account opt-out again produced false plus zero
  active backend devices. The owner's explicit opt-in was restored afterward.
- Live audience evaluation admitted the fixture owner and rejected the unrelated audit
  parent for course, camp and course-targeted club announcement events. The dispatcher
  readback contained one recipient, zero other recipients and zero pending/sending jobs.

Local screenshots are in the ignored `motiontimisoaraApp/tmp/push326-evidence/`
directory: `foreground-attendance-tap.png`, `background-course-tap.png`,
`closed-camp-tap.png`, `background-announcement-tap.png` and `permission-denied.png`.
The foreground toast capture is retained there as `foreground-attendance-toast.jpeg`;
`account-switch-coach.png` records the separate coach dashboard.
Final-build captures are `offline-retry-final.png`, `final-build-attendance-tap.png`
and `final-enabled-clean-account.png`.

The initial locked startup emitted Capacitor bridge/safe-area initialization errors;
the later receipt and navigation probes emitted no application error. Global device
CPU measurements were not interpreted as app-specific performance measurements.
An offline-queued message was accepted by FCM, but a delayed alert was not observed after
reconnection. That attempt is not claimed as device-delivery proof; expiry and delayed
binding rejection are covered by the isolated native and backend contracts. An additional
offline retry was still pending at the harness's 16-second observation limit; it recovered
after reconnection. The per-operation deadlines do not promise a ten-second total across
session, preference and native cleanup steps.

Cleanup removed the exact authorized child, enrollment, occurrence, attendance, course,
camp and three announcements, together with their 17 events and 15 delivery rows. No
other recipient was present. Readback confirmed zero remaining disposable business
records and zero push events/deliveries. Existing audit accounts, Club Audit Motion and
the owner's account were retained. Wi-Fi and Flight mode were restored to their original
on/off states. iOS/APNs and frontend/store publication remain deferred.

## Final source review

The final working diff was independently reviewed locally for React/auth, Android/CI
and backend authorization/delivery. No confirmed finding remains. Review covered
binding/session isolation, asynchronous cancellation, permission and token lifecycle,
payload routing, outbox leases, audience revalidation and credential handling. The
offline fix received a further local review, which found and corrected Supabase's
pre-fetch auth wait escaping an abort-only deadline. Its focused tests, full application
suite, typecheck, lint and final Android build passed. Required CI on PR #84 must be
green on its final revision before merge; device verification and cleanup are complete
for the approved Android stage, with the delivery limitations stated above.
