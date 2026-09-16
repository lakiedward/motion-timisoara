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

## Outstanding evidence and gates

- Galaxy A55 (Android 16) was detected and its existing application opened. It
  disconnected before installation of the new APK. This does not establish device
  verification of the new shell. Installation, keyboard, safe-area and Android back
  checks are pending reconnection.
- No iOS runtime/device verification has been performed.
- Parent and admin navigation is covered by automated tests, but no current live
  login for those roles is available. The owner does not know their credentials.
- Final human visual acceptance, CI and merge remain pending. No production deploy
  or store publication is included. To-Do #156 remains In progress in Team Tracker.

## Review

Reviewed the final authored implementation against base `6141e95` in the current
session: route guards, role destinations, authentication state, payment and push
listener placement, shared web navigation, back behavior, layout offsets, canonical
primitives and token usage. No unresolved code defect was found. The device and
human gates above remain separate from this code review.
