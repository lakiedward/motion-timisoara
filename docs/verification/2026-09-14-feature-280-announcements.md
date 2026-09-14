# Feature #280 verification

## Implementation and review

PR #83 combines club targeting for owned camps with parent UI Coverage section #544: source author, course link, both attachment sources, visit-based new markers, server pagination, course filtering and separate failure/empty/loading states.

Independent local reviews covered the SQL/API and parent/media components. Three confirmed findings were fixed and regression-tested: visit retries crossing accounts, mutable pin order crossing page boundaries, and inserting another profile as a course announcement author. No actionable findings remained in those reviewed areas.

## Automated evidence

- Application: typecheck and lint passed; 84 Vitest files / 908 tests passed; production build passed. Existing large-chunk and mixed Capacitor import warnings remain.
- Final API after generated-type integration: 13 tests and typecheck passed.
- Isolated PostgreSQL: 67 assertions passed using authenticated/anonymous roles and two concurrent connections. Coverage includes all audience kinds, ownership, canceled enrollment, hidden/future/expired rows, source collisions, pagination, filters, author/contact-field isolation, visit races, order changes, immutable identity and course transfer. The container and volumes were removed.
- The SQL runner is included in App CI. No local Playwright or CDP was used.
- The first CI run exposed outdated API fixtures in the existing camp-location simulation. Its four failing cases reached the new feed RPC and received the fixture's deliberate unexpected-request 500. The fixture now models the three announcement RPCs, validates the visit identity and asserts that the parent used them; unexpected requests and console errors remain failures.

## Browser evidence

Chrome verification used the actual React components and styles at 1440×900, 768×1024 and 375×812. A local harness at `http://127.0.0.1:3025` explicitly labels all data as simulated and blocks external backend traffic. It is ignored by Git and is not part of a production build.

Observed parent scenarios: twenty rows followed by twelve more; filtering and an empty selected course; an initial request failure and recovery; later-page failure preserving existing rows; order-change warning and coherent reload; independent course/media/visit retries; loading and empty copy; actual course route navigation; coach URL attachment opening a new tab; photo dialog with Escape and focus restoration. New-marker stability and cross-account behavior also have dedicated component regressions.

Observed club scenarios: only active camps offered for new targeting; historical camp entries retained in the filter; a simulated camp announcement saved with its target label and the form reset; target filtering retained the two matching messages. Layouts were inspected at all three sizes.

Local captures and browser logs are under `.test-evidence/feature280/`. A temporary fixture inspection error caused by JavaScript metadata access to the backend guard was fixed in the harness; the final parent fixture report had no uncaught errors.

## Live backend evidence

Migration 00055 was applied as `20260914154559`; migration 00056 as `20260914160121`. Live readback confirmed CAMP in the constraint/resolver, authenticated-only SECURITY INVOKER RPCs and the author-bound INSERT policy. Generated client types match the applied schema.

An authenticated audit-parent query returned the enrolled audit course and an empty eligible feed. The existing signed-in browser session at `http://127.0.0.1:3017/account/announcements` displayed the real empty state after the migration. No application errors appeared in its console; browser-extension warnings and the existing Stripe-on-local-HTTP warning were separate.

No announcements, enrollment fixtures or messages were created in production. No frontend or native release is claimed. Human visual acceptance and the final PR checks remain delivery gates.
