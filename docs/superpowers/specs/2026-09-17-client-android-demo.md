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
