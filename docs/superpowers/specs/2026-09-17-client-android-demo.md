# Android client demonstration

The owner requested a September 10–17 change report, populated demonstration accounts
for every role, and an Android download whose interface follows the default branch.
The default branch is `master`.

## Delivery

- A dedicated Netlify site hosts the current application, using the existing product
  backend and its test Stripe configuration. Demonstration records are explicitly
  named DEMO. No real charge, invoice or location capture is created by provisioning.
- Four newly created, confirmed accounts cover parent, coach, club and administrator.
  Credentials remain in an untracked private handoff outside the repository. Admin
  access is real product administration, not a restricted sandbox role.
- An opt-in Android demo build loads the fixed HTTPS demo origin. Regular builds
  continue to use bundled assets. Capacitor documents `server.url` as a development
  mechanism; this is a client preview channel, not a store release or an offline app.
- A stable GitHub release asset provides the APK. It uses the existing Android package
  and local debug signing identity, preserving native plugin configuration. Devices
  with an incompatible signing identity must not be silently reset or uninstalled.
- A GitHub workflow waits for successful App CI and the web verification workflow on
  the exact current `master` revision before publishing the demo site. It never reads
  code from an untrusted PR in a privileged workflow. Credentials are Actions secrets.
- Web changes appear on a cold application start after publication. Native plugin,
  permission, Firebase or Android changes require rebuilding and reinstalling the APK.
  No silent Android package installation is promised.

## Verification

Run typecheck, lint, application tests, build, native unit tests and APK compilation.
Inspect the packaged Capacitor configuration, signing verification, HTTP download and
live build metadata. Exercise the four accounts in the browser and read back seeded
relations. Device execution requires a connected Android device and remains explicitly
unverified if one is unavailable. Review final diff and require green CI before merge.

Source: https://capacitorjs.com/docs/config

## Recorded verification, September 17

- Typecheck, lint, 1,104 application tests and the production build passed locally.
  Existing large-chunk and mixed Capacitor import warnings remain.
- The Android unit-test task accepted the 22 cached passing cases; debug assembly
  succeeded. APK v2 signature verification passed. Its packaged server is exactly
  `https://motiontimisoara-demo.netlify.app` with cleartext disabled. A second sync
  without the demo flag restored the regular bundled-assets native configuration.
- The public APK download was fetched and matched the local SHA-256:
  `ee908de5e21a135ee41f1d29cf98a3a9e1a844c477fc86748c6f5b8e643efd22`.
- Four accounts authenticated through Supabase using ordinary password login.
  Read-back checked the roles, two children, four enrollments, three coach courses
  and two club camps. Provisioning was transactional and refused duplicate seeds.
- Browser checks used the local app at port 3017 and the dedicated public demo site.
  At 375×812, parent announcements and the free/EUR camp displayed the seeded data.
  At 1440×900, club login, camp editing, coach login and admin login reached their
  correct routes. The camp form showed the saved dates, rules, bag categories,
  exchange rate, free age band and accepted coach. Captured browser error logs were
  empty. Evidence is local under `.test-evidence/client-demo/`.
- No physical Android device was connected. This APK's launch, permissions, native
  login, push and payments are not claimed as newly device-verified. Earlier feature
  delivery evidence is linked separately in the presentation.
- Initial branch CI exposed a pre-existing reset-password test race: it asserted the
  route before React Router finished navigation. The assertion now waits for the
  intended route without loosening the update and refresh assertions. Product code
  is unchanged. Final CI must verify this revision before merge.
- Another parallel CI run exposed a location-viewer test sending an invalidation
  before its mocked Realtime subscription was installed. The test now waits for
  that subscription before exercising the pending-read/revocation race. Its privacy
  assertions remain unchanged.
- Current-session review covered the final diff, default-build isolation, fixed HTTPS
  origin, secret handling, public artifact contents, workflow trust boundaries and
  the exact-SHA deployment gate. No unresolved code finding remains.
