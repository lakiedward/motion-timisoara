# To-Do #156 verification

## Scope and revision

Branch `codex/todo-156-native-navigation`, based on `6141e95` from `origin/master`.
The owner accepted the role-specific destinations in the accompanying specification
before implementation. The shared native shell replaces native hamburger menus and
the parent horizontal strip. Existing web navigation is retained.

## Automated checks

- Application typecheck and ESLint passed without new warnings.
- The full Vitest run passed 1,101 tests; its only failure was the generated UI
  conventions document. After `npm run conventions`, all 12 convention tests passed.
- Two additional shell integration tests passed, including a direct child-profile
  back fallback and removal of admin destinations after sign-out. Together with the
  preceding run, the 1,104 current tests have passed. No product code changed after
  the full run; the additional changes were test coverage and generated documentation.
- Navigation tests cover the accepted order for all four roles, guest links,
  secondary role destinations, detail-route selection and fallback destinations.
- Account tests cover anonymous access, loading, profile failure/retry and sign-out
  failure/retry.
- Production build and Android `assembleDebug` passed. Existing large-chunk,
  Capacitor dynamic-import and Gradle flatDir warnings remain.
- `git diff --check` passed. Changed authored files stay below 600 lines; the new
  native navigation directory contains 10 files. CLAUDE.md and AGENTS.md hashes match.
  The repository still has no `check:rules` command.

## Browser evidence

Used the Codex in-app browser accessibility controls and screenshots, without local
Playwright or Chrome DevTools. A development-only native navigation preview flag
activates the shell without activating native plugins or bypassing authentication.

| Target | Viewport | Steps and result |
| --- | --- | --- |
| `http://127.0.0.1:3018/exploreaza` | 375x812 | Guest discovery links, four guest tabs and Cont/login access render without a hamburger. |
| `http://127.0.0.1:3018/coach` | 375x812 | Signed in with the current coach audit credentials; the five accepted tabs appear. |
| `http://127.0.0.1:3018/cont` | 375x812 | Coach secondary routes are reachable. Opened Locations and returned with the top back button. Scrolled to the bottom: both bars remain visible and sign-out remains reachable above the bottom bar. |
| `http://127.0.0.1:3017/club/announcements` | 375x812 | Reused the existing club audit session. Native tabs show Dashboard, Courses, Camps, Announcements, Account. Opened Announcements and Account, retaining profile, coaches, locations, payments and personal account links. No announcement was sent. |
| `http://127.0.0.1:3017/` with preview disabled | 1440x900 | The existing desktop public header and account menu remain. |
| `http://127.0.0.1:3017/club` with preview disabled | 768x1024, 375x812 | Existing tablet/mobile portal header and hamburger menu remain functional. |

No browser console errors were observed. Local HTTP produces the existing Stripe
HTTPS warning. Opening the existing web Sheet also produces its existing missing
description warning. The native shell does not use that Sheet.

Local screenshots are stored outside the public repository in
`C:/Users/lakie/Documents/Codex/Reports/motion-todo-156/`.

## Android device evidence

After reconnection, installed the APK built from `5d0c5ce` on Galaxy A55 5G,
Android 16, physical resolution 1080x2340. MobAI performed all device interactions.
The installation preserved the owner's existing parent session. Checks were
read-only; no child, enrollment, payment or message was created, and no logout
or password change was performed.

- Cold launch retained the parent session and displayed the five accepted tabs.
- Opened Home, Explore, Children, Announcements and Account. Children and
  Announcements showed their empty states; Account retained secondary destinations.
- Scrolled Account to the bottom. Both bars stayed visible, the sign-out control
  remained accessible above the bottom bar, and system status/gesture areas did not
  overlap the controls.
- Opened Contact and focused its empty name field. The keyboard resized the WebView;
  the focused field remained visible and the bottom bar stayed above the keyboard.
  Android Back first dismissed the keyboard, then returned to Account. The top-bar
  Back control independently returned from Contact to Account.
- Sent the app to the background and reopened it. Explore and the parent tabs were
  preserved. Left the app on Explore for human review.
- Captured logcat contained Android/WebView platform diagnostics, but no matching
  fatal exception, ANR or uncaught JavaScript error during these checks. MobAI's
  generic memory-growth alert compared cold-start 88.6 MiB with loaded pages; memory
  ended at 241.0 MiB, below its 302.5 MiB peak. This is not a memory-leak benchmark.

Screenshots: `android-parent-explore.png`, `android-parent-account-scrolled.png`,
`android-keyboard.png` in the local evidence directory above. Metrics session:
`8283f772-1bf6-4609-b338-1111f553c858`.

## CI and outstanding gates

All CI checks for `5d0c5ce` passed, including app tests/build, Android build,
iOS simulator compilation, SQL/contracts and the repository's existing integration
workflow. iOS compilation is not iOS device UI verification.

- No iOS runtime/device UI verification has been performed.
- Admin navigation is covered by automated tests, without a current live admin login.
- Final human visual acceptance and merge remain pending. No production deploy or
  store publication is included. To-Do #156 remains In progress in Team Tracker.

## Review

Reviewed the final authored implementation against base `6141e95` in the current
session: route guards, role destinations, authentication state, payment and push
listener placement, shared web navigation, back behavior, layout offsets, canonical
primitives and token usage. Reviewed implementation revision: `5d0c5ce`. No unresolved
code defect was found. Android verification required no code changes. The remaining
verification limits and human gate above remain separate from this code review.
