# Bug #1092 implementation and verification plan

1. Preserve the worktree baseline and existing native navigation contracts. Read
   the canonical native shell, auth layout, platform helper and generated UI
   conventions. Confirm exact official Keyboard 8.0.5 compatibility and behavior.
2. Add the pinned plugin and Native resize configuration. Wait for visible iOS
   accessory controls in bootstrap, leaving web and Android startup unchanged.
3. Bound the native shell to the viewport and move page scrolling into its main
   content. Keep the header and navigation in flow and route reset on that scroller.
   Disable outer iOS WKWebView scrolling only while the shell is mounted.
4. Add meaningful bootstrap/platform and route-reset regression contracts. Run app
   typecheck, lint, tests with four workers and build sequentially, stopping at a
   failed command. Synchronize native integration and inspect generated changes.
5. Review the exact final diff. Verify browser geometry and forms on the isolated
   preview. Rebuild and retest the installed iOS app with visible accessory arrows,
   recording the reported sequence and long-form/search comparisons.
6. Keep delivery and tracker completion with the coordinating session. Do not
   claim a native pass, merge, release or Fixed status from a local build alone.
