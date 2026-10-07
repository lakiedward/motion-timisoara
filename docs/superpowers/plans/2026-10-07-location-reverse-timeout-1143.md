# Location lookup timeout delivery

1. Add a bounded request helper with caller cancellation and cleanup.
2. Fall back after a bounded house request; avoid automatic search retry delays.
3. Verify hanging fetch/body, fallback, caller abort and existing synchronization tests.
4. Run typecheck, lint, tests, build; verify real Chrome map interaction and bounded failure/retry behavior.
5. Review final diff, merge after CI, publish and verify public behavior; update bug and inventory without changing human gates.
