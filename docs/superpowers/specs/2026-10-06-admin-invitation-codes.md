# Admin invitation codes and direct coach creation

UI Coverage section #455, `motion-react:page:/admin/codes:section:toata-pagina`, has eleven approved criteria. The owner approved the criteria through Team Tracker MCP and then requested implementation.

Keep the two independent workflows and the current theme and primitives. Give the page one heading, followed by the direct-coach and invitation-code section headings. Controls use the established 44px minimum and associated labels and errors.

Generation defaults to one use with no expiry. Accept a positive PostgreSQL integer and an optional future local datetime, store expiry as an ISO instant and show its date, time and local timezone. Validate again at the API boundary. Keep generated values visible even when clipboard access or list refresh fails. Report clipboard success only after the write resolves. Keep loading, failed loading with retry, and confirmed empty results distinct.

Disable repeated creation, generation and deletion while each request is pending. Keep deletion tied to its original row. Keep useful form values on errors. A direct coach result requires a confirmed COACH profile and coach profile; a partial failure must return an error and compensate only the new identity owned by that request.

Verification uses synthetic UI/API and backend contracts, the existing isolated invitation SQL/concurrency suite, and browser checks at 1440×900, 768×1024 and 375×812 in both themes. Real fixture creation, redemption and deletion are outside authorization. Browser rendering does not prove native runtime behavior.

Delivery stays in a draft PR. Do not deploy or merge while publication is excluded. Prepare the inventory delta for section #455 and parent #232 without changing canonical fingerprints or human gates before merge.

The source review on 2026-10-06 checked expiry validation, truthful clipboard feedback, pending request guards, deletion identity, and coach creation authorization and compensation. An incomplete native datetime input now blocks generation, while a genuinely empty valid input means no expiry. The Deno CI entrypoint check uses `--node-modules-dir=none`, matching the successful local check. The new API tests live in a focused subfolder rather than adding another file to the existing over-limit API folder. No confirmed source findings remain.

Application typecheck, lint, all 1,534 tests across 165 files, and production build passed before the test-file relocation and CI adjustment. The relocated API suite then passed all 17 tests, and the exact updated Deno entrypoint command passed. All 15 Deno contract tests, Deno format/lint checks, and the existing isolated invitation expiry and concurrent-use SQL suite passed.

Browser verification covered read-only real code listing at all three viewports in both themes, 44px controls and no horizontal overflow. Scoped synthetic responses covered loading, error/retry, empty results, configured generation payloads, direct-coach success/failure, clipboard rejection and failed deletion with pending locks; the overrides were removed before reloading. The latest partial-datetime behavior has regression-test proof; its final browser confirmation remains pending at this source review. The changed Edge Function is not deployed, and real creation or deletion smoke tests remain outside authorization.
