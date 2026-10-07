# Bug 1143 verification

Observed the public Chrome form remaining in reverse-lookup loading after a map click with county/city/address empty. The provider later returned an address after a long delay. Both house and general requests also exceeded an 8-second diagnostic deadline during this session.

Implementation bounds house lookup to 3 seconds, then general lookup to 5 seconds on empty/error/timeout. Search is bounded to 5 seconds with automatic query retries disabled. Request deadlines cover fetch and response body; caller cancellation does not start fallback. Exact map coordinates and existing error/manual completion UI are preserved.

Six new request tests cover stalled fetch, stalled body, caller abort, successful fallback, total timeout, successful cleanup and HTTP error propagation. Existing synchronization tests cover late responses, manual editing and retry. Full final test run: 176 files, 1,634 tests passed. Typecheck and lint passed. An earlier run discovered a test file before it was moved into its final folder and failed on the removed path; the complete suite was rerun after the move.

Chrome local verification at http://127.0.0.1:3017/club/locations/new: map click and retry finish with the existing error/retry UI during the slow live provider condition; Save is no longer blocked by loading. At 375x812 there is no horizontal overflow. Manual county/locality/address completion preserves the point and enables Save. No fixture was submitted. The exact timeout budget is proven by fake-clock contract tests; browser observations prove the resulting visible state, not an independent millisecond measurement.

Captures: local desktop error state at the session visualization path, reverse-timeout-local.png. A mobile screenshot timed out; DOM dimensions and manual completion were verified. Live autofill success under the final timeout was not observed while the provider was unresponsive. Native-device behavior is unverified. No schema or new provider changes.

Production build passed with existing Capacitor mixed-import and large-chunk warnings. Current-session review inspected deadline cleanup, caller abort versus timeout, fallback behavior, stale-response guards and unchanged form/RLS writes. No unresolved actionable finding. Merge/publication and inventory synchronization remain separate delivery steps.
