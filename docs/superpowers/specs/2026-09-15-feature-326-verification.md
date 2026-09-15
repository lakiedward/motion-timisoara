# Feature 326 verification

The approved stage covers Android parent notifications. iOS/APNs and frontend/store
publication are deferred. The owner approved the card's appearance, copy and merge
after successful verification on 2026-09-15.

## Automated verification

- Public database types regenerated after the live migration.
- Application typecheck, ESLint, 978 Vitest tests and production build passed.
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
their account on this phone. No payment was performed. The final debug APK, after all
temporary diagnostic probes were removed, has SHA256
`56002320739B553AD1C52A69FF9BA62C47DA69D86F3D165E3A26A89643DB3265`.

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
- Live audience evaluation admitted the fixture owner and rejected the unrelated audit
  parent for course, camp and course-targeted club announcement events. The dispatcher
  readback contained one recipient, zero other recipients and zero pending/sending jobs.

Local screenshots are in the ignored `motiontimisoaraApp/tmp/push326-evidence/`
directory: `foreground-attendance-tap.png`, `background-course-tap.png`,
`closed-camp-tap.png`, `background-announcement-tap.png` and `permission-denied.png`.
The foreground toast capture is retained there as `foreground-attendance-toast.jpeg`.

The initial locked startup emitted Capacitor bridge/safe-area initialization errors;
the later receipt and navigation probes emitted no application error. Global device
CPU measurements were not interpreted as app-specific performance measurements.
Account-switch verification and fixture cleanup remain in progress and must be completed
before merge. iOS/APNs and frontend/store publication remain deferred.

## Final source review

The final working diff was independently reviewed locally for React/auth, Android/CI
and backend authorization/delivery. No confirmed finding remains. Review covered
binding/session isolation, asynchronous cancellation, permission and token lifecycle,
payload routing, outbox leases, audience revalidation and credential handling. The
reviewed source is the source committed with this report; CI on the PR revision and
the remaining device/cleanup steps are still required before merge.
