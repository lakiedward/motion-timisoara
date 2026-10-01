# Google coach invitation onboarding

Date: 2026-10-01. Authorized by the owner: plan and implement Google plus invitation-code signup.
Base: origin/master afde2af. Branch: codex/feat-coach-google-invitation.

## Result

An invited coach can use Google or email/password. Google authenticates the existing Supabase identity; an explicit confirmation redeems the invitation and creates the coach profile without a duplicate user. An existing PARENT can follow the same flow. Existing COACH, CLUB and ADMIN roles are preserved.

## Build sequence

1. Add a service-role-only transactional invitation operation. Lock the profile and invitation, validate active/verified identity and invitation expiry/capacity, then persist COACH, profile, selected sports and invitation usage together. Existing coaches are idempotent. Reject disabled users and CLUB/ADMIN conversion. Reuse the operation for password registration so concurrent methods cannot bypass the same invitation limit.
2. Add authenticated redeem-coach-invitation Edge Function. Derive user ID from validated JWT, never request-body identity or OAuth metadata. Google redemption has no automatic Stripe financial account creation; payment setup remains available from the coach panel.
3. Extend the existing three-step coach wizard with Google and existing-account sign-in. Keep the password route. Preserve only a short-lived invitation draft across web/native OAuth; exclude passwords and invitation codes from URLs. Signed-in PARENT sees their email and coach details; final confirmation is explicit.
4. Route the exact coach continuation back to the wizard without forcing the generic OAuth phone form. Keep coach phone optional. Preserve ordinary OAuth behavior and the native coordinator's session, PKCE and replay protections. Normalize final return paths to avoid auth loops.
5. Confirm refreshed COACH before navigating. Show retry if profile refresh fails after the transaction, without consuming the code again.
6. Run SQL isolation/concurrency and Edge contract checks, application typecheck/lint/tests/build, browser checks at 375x812, 768x1024 and 1440x900, and independent diff review. Commit task files, push and open a PR. Final human UI acceptance precedes merge; backend migration/function publication belongs to this authorized feature after review.

## Important behavior

- Profile.role is a single role. Upgrading PARENT preserves their existing children/enrollment rows; dual-role navigation is outside this feature.
- No automatic role promotion from Google metadata or email-domain matching.
- No changes to real users' passwords, Google provider secrets, Stripe server mode or tracker human gates.
- Existing password signup's optional Stripe behavior is preserved. A disposable successful password-signup check needs sandbox proof or user final submission, as in the preceding verification.
- Native OAuth routing is retained and contract-tested. Browser proof is not native runtime proof.

## Acceptance and verification

- Anonymous code -> Google -> same invitation -> coach details -> confirmation -> /coach.
- Existing authenticated PARENT can redeem a valid code using the same auth UUID and email.
- Invalid, expired and exhausted codes leave role/profile/usage unchanged.
- Concurrent consumers of a one-use code produce exactly one successful promotion.
- Invalid sports or profile write failure roll back all invitation/promotion changes.
- Repeated success produces one profile and one code use.
- CLUB/ADMIN and disabled users cannot be promoted or have their existing roles overwritten.
- Refresh failure displays recovery and never navigates under an unverified role.
- Password signup, normal Google login and unrelated return URLs retain their behavior.
- No invitation capability or password in redirect addresses; expired drafts are removed.

## UI Coverage delta

Existing identities remain: page #272 and section #513 (/register-coach), callback page #238 and sections #541/#687. Google button consumers share canonical code. Preserve existing human gates and criteria. Record draft SHA/PR; update canonical fingerprints only after actual merge. The previous criterion #302 redirected every authenticated user; this owner's new explicit request changes PARENT behavior and must be documented for human acceptance.

## Delivery evidence

Verified locally on 2026-10-01:

- Application typecheck and lint passed. All 1,425 tests across 154 files passed with a 20-second per-test timeout. Default-timeout runs exposed slow filesystem inventory checks; they did not expose an application assertion failure after regenerating UI conventions. Production build passed with the existing large-chunk and Capacitor dynamic-import warnings.
- Eleven Deno contracts, both Edge entrypoint typechecks, and isolated SQL rejection, rollback, preservation, ACL and concurrency checks passed. The SQL fixture models service_role without SELECT on auth.users and covers both a shared one-use invitation race and same-user retries.
- Five live unauthenticated HTTP requests were rejected with 401, including malformed JSON and forged identity bodies. No real session was used for these rejection probes.
- Chrome completed real Google authentication on the owner's selected test identity, preserved the invitation across the redirect, displayed fixed email and optional phone, and reached /coach after the owner's final confirmation. The owner changed the invitation and selected all six available sports before submitting. Live database reads confirm one enabled COACH identity, one coach profile, all six associations, a used invitation tied to that identity, and no Stripe account. The original administrator remains enabled with role ADMIN.
- A second visit to /register-coach redirected to /coach without registration. Browser checks at 375x812, 768x1024 and 1440x900 showed no horizontal overflow. The clean browser session logged zero application errors; Stripe.js warned about the HTTP development origin.
- The temporary localhost OAuth callback was removed after authentication; the original four production/native callback entries and Site URL were restored. The unused disposable one-use QA invitation was expired. The owner-selected account is retained.

Backend publication: remote migration 20261001100205; redeem-coach-invitation ACTIVE v1 (JWT enabled); register-coach ACTIVE v7 (existing anonymous entry point). Database types were regenerated from the live schema. RPC and private identity helper EXECUTE remain unavailable to anon/authenticated; auth.users table grants remain unchanged.

Native OAuth runtime and a newly rebuilt APK are not verified by this browser task. Human UI acceptance, final reviewed SHA/PR, CI and merge remain delivery gates. Existing Team Tracker human gates and canonical inventory fingerprints are unchanged until authorized final acceptance and merge.
