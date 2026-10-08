# Implementation plan — bug 1143

1. Record the provider diagnosis and reopen bug 1143; preserve human UI gates.
2. Implement and locally test service-only cache/lease migration 00084, append-only provider-neutral adjustment 00085 and the authenticated reverse fallback function.
3. Add typed client failover, cancellation and bounded in-memory caching. Retain current form controls and error handling.
4. Run isolated SQL/concurrent tests and Deno contracts before applying the product migration/deploying the function; verify remote state and regenerate types.
5. Run application typecheck, lint, full tests and build, then real Chrome create/edit checks at the required viewports, including a real independent-provider response with Photon unavailable.
6. Review the final diff, commit only task files, create a PR and merge after green CI. Verify public demo SHA/assets and repeat successful map autofill there.
7. Synchronize only affected CLUB UI inventory/evidence, close the bug after actual delivery and record the new Pontaj checkpoint. Report native/video limits explicitly.
