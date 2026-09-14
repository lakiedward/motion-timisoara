# Feature 323: native Google authentication

## Accepted outcome

Google authentication returns to the requested in-app destination. Invalid,
expired and repeated callbacks cannot establish a session. Web OAuth and existing
email/password flows retain their behavior. Android and iOS device verification
remain distinct; Android is available in this session, physical iOS is not.

## Design

Use a dedicated Supabase PKCE client and the official Capacitor Browser plugin.
The main Supabase client retains its existing flow type. The dedicated client
persists only its PKCE verifier in Capacitor Preferences; temporary OAuth sessions
remain in memory. Successful exchange hands the session to the main client.

Register `com.motiontimisoara.app://auth/callback` on Android and iOS. Register the
same callback with a query suffix in the Supabase redirect allowlist. Subscribe
to App appUrlOpen before reading getLaunchUrl so both running and cold starts work.

A serialized coordinator persists one transaction: random nonce, validated local
return path, creation time and awaiting/exchanging state. The callback must match
the exact scheme, authority and path, one nonce and one code, no fragment, and a
matching transaction younger than ten minutes. Never accept URL session tokens or
a return path supplied by the callback. Persist consumption before exchanging.
Duplicates, unknown callbacks and stale nonces cannot exchange or alter a session.

Browser dismissal is not proof of cancellation because it races with appUrlOpen.
Provide an explicit cancel action and preserve pending state across app restarts.
Password authentication and sign-out cancel pending Google authentication. A late
exchange cannot replace a session established by another authentication action.
Password/signup/sign-out operations share the coordinator queue, so new Google
attempts cannot race with a pending password request. Session installation is a
non-cancellable final step; the cancel button is disabled during that step.
Navigate through the existing profile-completion page after a successful handoff.
Fix its existing listener/timer cleanup and avoid async work inside auth callbacks.

## Verification

Unit tests cover cold starts, invalid origins/paths/parameters, nonce mismatch,
expiry, replay/concurrency, cancellation, failed exchange/session installation and
local return validation. Component tests cover listener lifecycle and feedback.
Run typecheck, lint, complete Vitest suite and production build, Android assembly,
independent review and available CI. Use the connected Galaxy A55 for Google login
with the owner's selected account, cancellation, return path and restart checks.
The owner enters Google credentials and confirms provider access. Preserve their
account and profile. No physical iOS success is claimed without that verification.

## Sources

- https://supabase.com/docs/guides/auth/sessions/pkce-flow
- https://capacitorjs.com/docs/apis/app
- https://capacitorjs.com/docs/apis/browser
- Installed @supabase/auth-js: persistSession=false ignores supplied storage;
  the verifier uses the dedicated storage key plus `-code-verifier`.
