# Feature 323 delivery evidence

## Implemented behavior

Native Google uses a dedicated Supabase PKCE client, a persisted single-use
transaction and the Capacitor Browser plugin. Android and iOS register
`com.motiontimisoara.app://auth/callback`. Warm and cold launches feed the same
serialized coordinator. The main auth client retains its web/email flow type.

Callbacks cannot supply session tokens or choose a return route. The locally
recorded nonce, expiry and consumption state must match before code exchange.
Password/signup/sign-out operations share the queue. Cancellation cannot install
a late Google session, and the final session installation is non-cancellable.

The existing profile-completion screen now owns its polling cleanup and reports
profile-save errors instead of navigating after a rejected save.

## Remote configuration, 2026-09-14

The Google provider was disabled in the product Supabase project. Created the
dedicated Google Cloud project `motion-timisoara`, configured the OAuth consent
screen in **Testing** mode and added the owner's selected test account.
The web OAuth client `Motion Supabase Auth` redirects only to
`https://ehdzafadshbaaghzdzdo.supabase.co/auth/v1/callback`.
Its credentials were transferred directly to the product Supabase Google provider,
which is now enabled; nonce checks remain enabled. No credentials are in the repo.

Added `com.motiontimisoara.app://auth/callback**` to the Supabase redirect allowlist.
The production site URL and existing web/password-reset redirects were preserved.
Google production publishing and store releases are not part of this test setup.

## Verification boundary

The coordinator and adapter tests cover nonce/path/code rejection, expiration,
replay, cold restoration, verifier-only persistence, session handoff, cancellation
races and serialization with password authentication. Listener component tests
cover warm/cold URLs, StrictMode cleanup, asynchronous unmount and web isolation.

Local application TypeScript, lint, all 799 Vitest tests (78 files) and production
build have passed. The build retains the existing chunk-size and mixed-import
warnings; the repository's proposed check:rules command is still absent.
The Android debug application assembled successfully and was installed through
MobAI on the connected Samsung Galaxy A55 5G, Android 16, 1080 x 2340.
The installed candidate restored the pending Google attempt after an app restart.
Its cancel action returned the button to its ready state, and a new attempt opened
Google account selection again. Screenshot: local ignored artifact
`.test-evidence/323-native/restored-pending-google.png`.
The owner subsequently completed Google consent and reached profile completion.
The native app retained the owner's authenticated session after the phone closed
and after installing the next debug build. A read-only backend check confirmed the
Google identity and the successful sign-in at 09:21:03 UTC on 2026-09-14.

The interruption exposed a missing recovery action: the parent dashboard had no
way to reopen an incomplete profile. Added a conditional canonical Card and
`Completează profilul` action. On the phone, Menu > Contul meu > Completează profilul
opened the existing name/phone form without a new login. The owner supplied the
phone number and completed the save. The app returned to the parent dashboard,
the recovery card disappeared, and a read-only boolean check confirmed the phone
was saved. No real profile fields were invented, disclosed or reset.

Chrome at `http://127.0.0.1:3017/login?returnUrl=%2Faccount%2Fenrollments`,
1665 x 893 viewport: the audit parent's password login returned to the live
`/account/enrollments` screen. The six baseline enrollments were visible. No
enrollments or payments were created. Browser console and responsive variants are
not recorded as verified by this check.

Pending: a non-default return-path check on Android;
full web Google regression; physical iOS Google proof; human acceptance; final CI,
merge and release. Keep the PR in draft and tracker feature 323 open until the
required delivery evidence and gates are satisfied.

## Review

An independent local agent reviewed the coordinator, client adapter, native URL
configuration, listener and web callback changes. Cancellation races found during
review received regression tests and fixes. A rejected native listener registration
also received cleanup protection. This is agent review, not an external bot result.
The final reviewed commit and CI results belong in the PR delivery record.

Initial PR CI passed the application, Android and web test jobs. iOS compilation
also succeeded, but the separate synthetic location harness readiness check timed
out at 180 seconds; its ready event arrived at 191.5 seconds. This is not physical
iOS OAuth proof. Recheck the next CI run; no location thresholds were changed.
