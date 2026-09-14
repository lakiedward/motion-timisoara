# Feature 325 verification, 2026-09-14

## Scope and environment

This is the agreed Android custom-scheme stage. The web source is verified locally at `http://127.0.0.1:3017`; it is not a production frontend release. Android uses the locally assembled debug APK on a real Galaxy A55 SM-A556B, Android 16, 1080x2340. Device actions used MobAI native accessibility. Chrome verification used the extension accessibility API, without local Playwright or CDP.

## Observed results

| Scenario | Result |
| --- | --- |
| Parent signup and real confirmation email, Motion force-stopped before opening Gmail link | Passed: Android launched and returned to login; product Auth recorded email confirmation and PKCE exchange. |
| Reopen confirmation email while Motion was running | Passed: invalid-link state, no recovery form. |
| Real reset email with Motion force-stopped | Passed: Android launched, accepted the recovery grant and changed the disposable parent's password. Login with the new password reached that parent's account. |
| Native Google login after password recovery | Passed: Google account picker and the existing owner's account dashboard. |
| Reset the disposable parent's password while the owner's Google session was active | Passed with a fresh email while Motion was running. Afterwards, the owner's account dashboard remained authenticated. |
| Real expired PKCE flow | Passed: the request sent at 14:15:03 was rejected at 14:20:20 with HTTP 422 `flow_state_expired`; the form stayed unavailable. The native notice and local pending lifetime now match this five-minute limit. |
| Final rebuilt APK and consumed reset email | Passed: generic email-invalid heading, explanation, login action and reset link; no password inputs. |
| Direct web reset navigation without recovery grant | Passed: invalid-link state. |
| Actual web reset request and Gmail link | Passed through real delivery and an enabled local reset form. Final password submission/login awaits the owner's browser handoff. |
| Responsive invalid-email page | Chrome rendered the real app in an isolated iframe at 375x812, 768x1024 and 1440x900. Mobile and desktop captures were inspected; no clipped controls observed. These are iframe viewport checks, not native-device emulation. |

The valid confirmation path was exercised cold; its warm routing/replay path and the valid warm recovery path were exercised separately. A second valid signup confirmation with an already running app has not been exercised with another account lifecycle.

Local PNG captures are in the session's temporary `motion-325-evidence` directory; they are not uploaded to this public repository. Recorded captures include cold confirmation, cold/warm recovery, successful password login, preservation of the other Google session, and the final invalid-link state.

## Automated checks and review

`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` passed on the final implementation. Vitest: 868 tests across 82 files. `npx cap sync android` and Gradle `assembleDebug` passed; the final APK was installed successfully. The build retains existing large-chunk and ineffective Capacitor dynamic-import warnings. No `check:rules` command exists in this repository.

An independent agent reviewed the complete implementation and SDK integration, then reviewed the final copy, invalid-state actions and five-minute lifetime. No actionable findings remained. `git diff --check` passed. CI and merge status are recorded on the pull request.

MobAI Warning/Error capture contained no AndroidRuntime crash or Capacitor console error during the sampled run. It did contain existing menu DialogContent description warnings and missing `public/plugins` warnings. System-wide Chromium tile-memory warnings also occurred; this capture covered multiple apps and is not a performance benchmark for Motion.

## Remote configuration and remaining work

The existing production Site URL and Google redirects were preserved. Auth now allows `com.motiontimisoara.app://auth/email-callback**`. The owner configured Private Email SMTP for Motion; real confirmation and recovery messages were delivered after correcting the mailbox password. Existing templates use `ConfirmationURL`, preserving the selected redirect. Messages were found in Gmail Spam, so inbox deliverability is not established.

A temporary loopback reset redirect and the disposable test user are retained only until the pending web test is completed, then must be removed. No HTTPS association, frontend deployment, iOS build distribution or store release is published by this stage. The prepared debug association is intentionally outside the public build. Feature 325 remains open for HTTPS distribution associations and real iOS proof.
