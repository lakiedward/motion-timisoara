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

## Second cycle after installed SHA 9cc365f

The installed first candidate passed header safety but failed offscreen accessory
traversal, focused-input reveal and usable landscape content. The report is not a
global native pass. Continue from the exact committed first candidate:

1. Read the actual native failure report and official plugin/WebKit mechanisms.
   Gather read-only runtime geometry and focus-event snapshots before choosing the
   smallest fix. In particular, distinguish a refused next-field focus from a
   completed focus whose input was not revealed.
2. Preserve the bounded scroller, safe-area header and native accessory controls.
   Resolve focused-field ownership and actual landscape viewport budget. Do not
   subtract keyboard height twice or treat a focusin listener alone as a cure for
   native traversal that never changes focus.
3. Add focused contracts for geometry, keyboard visibility and lifecycle cleanup
   relevant to the confirmed change. Run the complete required app commands in
   order, stop on failure, sync native integration and review the final diff.
4. The coordinating session verifies browser behavior and requests installed exact
   SHA native retest. Keep F1/F2/F3 open until that evidence passes the full requested
   sequence. Git, PR, merge, tracker status and release stay with that session.

## Third cycle after installed SHA 402fb29

1. Record the second candidate's native passes and remaining Register portrait and
   Login/Register landscape traversal failures, including the measured 81-pixel
   landscape main. Keep the cached accessory-state explanation explicitly inferred.
2. Prepare active and immediate neighbor centers before expanding full rectangles,
   and retain all remaining form centers when they fit. Add four-field portrait
   geometry contracts with validation spacing and traversal in both directions.
3. Add a shared opt-in auth field wrapper: native keyboard landscape uses a widened
   labeled two/four-column row for Login/Register. Preserve ordinary spacing,
   errors, server feedback, submit controls, DOM order and canonical input sizes.
   Verify the row against the measured landscape viewport without forcing focus.
4. Run typecheck, freeze functional source for coordinating browser review, then
   run lint, the complete bounded suite, build, native sync and path normalization.
   Review comments, tokens, source/folder limits and exact documentation mirrors.
5. The coordinating session reviews and commits the exact candidate for installed
   native retest. No pass claim or tracker closure follows from simulated browser
   geometry alone. This is the third and final local candidate in this task cycle.
