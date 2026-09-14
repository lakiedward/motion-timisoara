# Feature 325: Android email authentication

## Approved daily stage

On 2026-09-14 the owner approved real signup-confirmation and password-recovery email links opening the installed Android application, both cold and warm. Invalid, expired and repeated links must fail closed. Existing Google, password login and web recovery remain functional. iOS proof and publication of HTTPS distribution associations are deferred; feature 325 remains open for those requirements.

## Design

Reuse the native Google coordinator's serialization queue and listener. Email uses a separate PKCE Supabase client, verifier and pending transaction so it cannot overwrite Google's verifier. Persist only the pending transaction and PKCE verifier in Capacitor Preferences; keep temporary email sessions in memory. The pending transaction binds a random nonce, locally selected signup/recovery kind, creation time and consumption status. Only the exact custom callback `com.motiontimisoara.app://auth/email-callback` is accepted. Mark a transaction consumed before exchanging its one-time code. Callback parameters never choose the account, kind or return route.

Recovery receives a short-lived grant bound to the exchanged temporary session. Only that client changes the password. Recovery must neither replace nor sign out an unrelated main application session. Confirmation activates the account, discards its temporary session and returns to ordinary login, matching the existing registration instructions. Native requests explain that the email must be opened on the same phone/installation within five minutes. The local pending lifetime is five minutes, matching the observed server PKCE flow expiry. A newer request replaces the previous email transaction.

The existing web flow remains implicit. Capture the SDK's PASSWORD_RECOVERY event when the main client is initialized, before React mounts; a normal INITIAL_SESSION never grants recovery access. The reset form rechecks its grant on submit and expires it after ten minutes or session expiry. This guards the recovery UI; Supabase remains the authorization boundary.

Keep the production Site URL and existing redirects. Add only the email callback to the Auth allowlist; inspect templates for ConfirmationURL/RedirectTo preservation. Do not publish debug-certificate associations. Prepare an association artifact from the actual installed APK certificate outside the public build.

## Verification and delivery plan

1. Unit contracts: malformed/expired/replayed callbacks, wrong nonce/kind, cold restore, storage and provider failures, grant expiry, session isolation, direct reset navigation and auth serialization.
2. Browser: existing reset/login/Google flows and responsive form states at 1440x900, 768x1024 and 375x812, through Chrome without local Playwright or CDP.
3. Android: build/install locally, open real authorized test emails cold/warm on Galaxy A55, reset password then authenticate, reject reused/invalid links and check Google regression. The owner authorized a disposable parent email alias and deletion after testing; credentials and personal identifiers stay outside the repository.
4. Run typecheck, lint, full Vitest and build. Review final diff independently, fix confirmed findings, push PR and merge after checks. Record exact evidence and remaining HTTPS/iOS work in Team Tracker.

## References

- https://supabase.com/docs/guides/auth/native-mobile-deep-linking
- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/guides/auth/auth-email-templates
