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

## Diagnosis and proposed behavior

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
- Installed iOS software-keyboard, accessory-arrow and Done verification is pending
  the coordinating session's native retest. No native pass or release is claimed.

## References

- [Official Keyboard API](https://capacitorjs.com/docs/apis/keyboard)
- [Exact 8.0.5 iOS plugin source](https://github.com/ionic-team/capacitor-keyboard/blob/9f7acbf28984da0a3b224ceba3366e0707d75c06/ios/Sources/KeyboardPlugin/Keyboard.m)
- `motiontimisoaraApp/src/layout/native/NativeAppShell.tsx`
- `motiontimisoaraApp/src/layout/native/native-shell.css`
- `motiontimisoaraApp/src/features/auth/AuthLayout.tsx`
