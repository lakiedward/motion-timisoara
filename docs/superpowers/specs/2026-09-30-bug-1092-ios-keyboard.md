# Bug #1092: iOS keyboard must preserve the native screen header

## Reproduced behavior

On iPhone 17 Simulator with iOS 26.5, the installed Capacitor Debug app moves the
native Autentificare header and Back control outside the screen after submitting
the empty login form, entering `a` in Email, moving to Password with the keyboard
accessory down arrow. Tapping Done restores the layout. The Google sign-in control can sit below
the Dynamic Island. The public coaches search input also moves content into the
native header: the Antrenori title sits directly below the Dynamic Island while
the search keyboard and accessory controls are visible. The original app and the
unchanged native shell in PR #117 reproduce this.

The coaches directory comparison uses the real public directory: 12 rows,
`DEm` matches Antrenor Demo and Demo Coach, and `DEm` with the Înot filter leaves
Antrenor Demo. The last Antrenor Spec 504 row must remain reachable by scrolling.

## First candidate behavior

The native shell uses fixed bars over whole-document scrolling. Safe-area padding
and document scroll padding cannot prevent WKWebView's native focus panning.
The candidate makes the native shell a viewport-height flex column, keeps both
bars in its normal flow, and gives only the main content a bounded DOM scroller.
Route changes reset that scroller. The native root document cannot overflow.

Pin the official `@capacitor/keyboard` plugin to 8.0.5 and configure Native resize:
the actual WKWebView height changes while the keyboard is open. Its iOS source
hides the accessory bar during plugin load, so app bootstrap waits for
`setAccessoryBarVisible({ isVisible: true })` before rendering forms. Preserve
the down/up arrows and Done used by the reported reproduction. A bootstrap error
is logged and rendering continues so a native bridge failure cannot blank the app.

After the shell and DOM scroller mount, disable iOS WKWebView document scrolling
through the plugin. Restore it when the shell unmounts. This controls the outer
native scroll view while leaving the main DOM scroller and portal overlays intact.
Web and Android do not call the iOS-only plugin methods.

This is a candidate hypothesis until the exact installed iOS app passes the same
accessory-arrow reproduction. A browser viewport resize does not establish that.

## Required verification

- Unit contracts: await the accessory restoration; skip iOS-only calls on web and
  Android; reset the content scroller on route navigation without document scrolling.
- App typecheck, lint, bounded Vitest suite and production build.
- Browser: native preview at 375x812; login validation and field traversal; long
  registration form; public coaches search; route reset; accessible portal overlay.
  Verify the header, content and bottom navigation after a reduced viewport.
- iOS: rebuild and install this candidate, preserve visible accessory arrows and
  Done, repeat empty Submit -> Email `a` -> accessory Down -> Password -> Done.
  Record a video and screenshots with the header and Back inside the safe area,
  usable focused fields, scrollable long forms and restoration after dismissal.
- Compare public coaches search and a long form in the installed iOS app. Native
  keyboard and focus behavior remain unverified until this evidence is available.

The existing development-only `VITE_NATIVE_NAVIGATION_PREVIEW=1` flag enables the
actual native shell before app boot on an isolated Vite preview. It exercises
layout, route reset and portals without product-visible QA controls or post-boot
DOM substitutions. It does not emulate WKWebView's software keyboard.

## Candidate verification on 2026-09-30

- App typecheck and lint passed; lint emitted no warnings. The first typecheck
  stopped because the fresh dependency installation had not applied the existing
  Capgo patch. Running the project's `postinstall` script repaired the dependency
  installation without changing source, then the required checks were restarted.
- The complete bounded Vitest suite passed: 150 files and 1,362 tests, including
  accessory readiness, platform guards, document scroll ownership and route reset.
- Production build passed. It still reports the Capacitor core import in
  `galerie.ts` as both static and dynamic and a bundle exceeding 500 kB.
- Capacitor sync passed for Android and iOS and found Keyboard 8.0.5 on both. The
  existing path normalizer was run. Tracked integration changes are only the
  Keyboard Gradle dependency/settings and SPM package/product. Native generated
  web assets and local configuration remain untracked build output.
- The coordinating session verified the actual native shell in an isolated
  development browser with the existing native preview flag. At 375x440, login
  validation, Email `a`, Password and submit remained reachable: header 0..65,
  internal main scroll 185, document scroll 0, and the full viewport restored
  correctly. Long registration forms remained reachable at 375x440 and 812x375.
  Login/Forgot navigation reset main scroll to 0. A 12-coach simulated-backend browser
  fixture proved directory layout, search and last-row access with internal main
  scroll 3127, document scroll 0 and header 0. The reduced search viewport retained
  a visible search field. This fixture is not live data or native keyboard proof.
  These browser scenarios had no console errors or horizontal overflow. Evidence
  is in the session's `motion-ios-1092/local-native-browser-checks.json` and captures.
- Installed native retest of SHA `9cc365f935617d76dd1634a75890ba3bc66e1d95`
  failed the focused-field and landscape contracts below. No global native pass
  or release is claimed. The browser checks above did not establish those contracts.

## Installed first-candidate failures

The coordinating session's rendered PR #118 report identifies the exact installed
iPhone 17 / iOS 26.5 Debug app and confirms all 27 bundled dist assets byte-identical
to the tested SHA. Keyboard 8.0.5 uses Native resize and visible accessory controls.
This separates the failed candidate from a stale bundle or keyboard setup issue.

- F1: empty Login Submit -> software `a` -> accessory Down kept Email focused and
  did not reveal Password, in 3/3 clean cycles. Manually scrolling Password into
  view made the same Down work. Repeated Done restored the full viewport.
- F2: coaches name search, registration Name -> Down, and direct Password focus
  left the required field outside the usable content area after keyboard opening.
  Manual content scrolling recovered each portrait case.
- F3: landscape keyboard left header and bottom navigation adjacent with no
  visible content area. Login failed 2/2; Register and Coaches failed 1/1 each.
- The old header/Back displacement and Google/status-bar overlap did not recur.
  Public directory filtering, manual last-card access, route reset and Done worked.

The report did not inspect activeElement, DOM focus events, viewport geometry or
native WKWebView state. These are observations; the causal runtime path is pending
read-only native measurement. No real authentication, registration, recovery email
or protected mutation was performed.

## Second-cycle investigation

Keyboard 8.0.5's scroll suppression installs its UIScrollView delegate and resets
native contentOffset to zero. This suppresses panning but does not provide DOM
focused-input reveal. The current shell has no focus/resize/keyboardDidShow reveal
handler. Current WebKit source also filters assistable next fields using an
obscuration hit test: a field covered by the header or navigation can be excluded
before any focusin event. That source is a mechanism to investigate, not proof of
the exact installed iOS 26.5 build's behavior.

Read-only native measurements must include before focus, keyboard opening, failed
Down, manual scroll, Done and landscape: active element and focus-event order;
current and next input rects and center elementFromPoint; shell/header/main/nav
rects, main clientHeight/scrollHeight/scrollTop; innerHeight and visualViewport
height/offsets; computed safe areas; native WebView frame and UIScrollView state
when available. Native resize already subtracts keyboard height: do not subtract
it again from CSS viewport height.

The partial Safari inspector diagnosis of installed `9cc365f` measured a 402x874
baseline: header 127, main 648 and navigation 99 including bottom safe area 34.
With Email's software keyboard open, innerHeight was 471, main was 127..406 with
clientHeight 279, scrollHeight 511 and scrollTop 0, and navigation was 406..471.
Email was 351..387 and Password 445..481. Password's center therefore lay inside
the navigation band. Document offsets were zero. The inspector was available for
3m38s; after-Down focus events, center hit test and landscape geometry were not
captured. This grounds the offscreen geometry but does not confirm causal focus
refusal in that exact WebKit build.

## Second candidate behavior

Keep visible native Up/Down/Done, safe-area header/Back, Native resize and outer pan
protection. Listen to the native compatibility window keyboard events, which put
keyboardHeight directly on the Event object. Bottom navigation is hidden only
while a nonzero software keyboard is visible, and restored on keyboardDidHide.
While editing in landscape the top bar uses the established h-11 scale instead of
h-16, preserving its existing Back control and title. No keyboard height is
subtracted from the already resized CSS viewport.

Reveal the current editable field by changing only main.scrollTop. When space
permits, include the adjacent form fields or their centers so native arrows can
select fields that otherwise lie below the navigation band. When they cannot fit,
the complete current input takes priority. Never change focus, clone/move inputs,
intercept native arrows or scroll the root document. Clamp to main's actual scroll
extent and skip already-safe geometry and portal/outside-main focus.

Coalesce fresh geometry reads into requestAnimationFrame after focus, native
keyboard events, window/visual viewport events and main ResizeObserver callbacks.
Keyboard 8.0.5 delays its native frame resize, so keyboardDidShow alone is not the
final geometry signal. A scoped child/text MutationObserver also handles validation
errors and content changes that alter field positions without changing main's
fixed clientHeight; it observes no style attributes. Clean up every listener,
observer and queued frame on unmount, including StrictMode's effect replay.

These are grounded candidate policies, not native pass results. The original
F1/F2/F3 reproduction and header safety still require installed exact-SHA retest.

## Second-candidate local verification

- Typecheck and lint passed, with no lint warnings.
- Focused geometry/lifecycle/navigation contracts passed: 3 files, 15 tests.
- Complete bounded suite passed: 152 files, 1,374 tests. Geometry cases include
  the measured 127..406 main and 445..481 Password, a 72-pixel narrow viewport,
  adjacent center reveal, current-input priority, bounded/idempotent scroll,
  outside-main focus and validation changes without a main-height change. Lifecycle
  cases cover native Event properties, zero-height keyboard, event coalescing,
  tab restoration and StrictMode cleanup.
- Production build and Android/iOS Capacitor sync passed. Keyboard stays pinned
  to 8.0.5; the existing path normalizer was run. Sync added no tracked integration
  change for this second cycle. Build retains the existing static/dynamic Capacitor
  core and large-chunk warnings.
- Focused rule review found no authored comments or new design values; the native
  folder has 16 files, and changed source files remain below 600 lines. CLAUDE.md
  and AGENTS.md remain byte-identical. Pending house check:rules infrastructure is
  not claimed as an executed check.
- The coordinating session passed 13 browser geometry checks against the actual
  source in an iframe with simulated native keyboard events, safe areas and backend
  data. Login, Register, Recovery and Coaches kept focused fields visible with a
  matching center hit test in portrait. A 118-pixel landscape viewport retained
  header 45 and main 73, with navigation hidden, document offsets zero and no
  horizontal overflow. Done restored header 127, main 648 and navigation 99 in
  the 874-pixel viewport. Evidence: `motion-ios-1092/cycle2-browser-simulated-keyboard.json`.
  This simulation does not prove WKWebView accessory traversal or software keyboard
  behavior. Installed exact-SHA iOS verification remains pending; F1/F2/F3 stay open.

## References

- [Official Keyboard API](https://capacitorjs.com/docs/apis/keyboard)
- [Exact 8.0.5 iOS plugin source](https://github.com/ionic-team/capacitor-keyboard/blob/9f7acbf28984da0a3b224ceba3366e0707d75c06/ios/Sources/KeyboardPlugin/Keyboard.m)
- [WebKit assistable-element selection](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/WebProcess/WebPage/ios/WebPageIOS.mm)
- [WebKit native focus and reveal](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/WKContentViewInteraction.mm)
- `motiontimisoaraApp/src/layout/native/NativeAppShell.tsx`
- `motiontimisoaraApp/src/layout/native/native-shell.css`
- `motiontimisoaraApp/src/features/auth/AuthLayout.tsx`
