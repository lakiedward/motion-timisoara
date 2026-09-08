# Feature 319: QR attendance

## Scope

Coaches scan a child's existing MT1 QR code from a selected course occurrence. The course and date remain explicit. Manual present, absent, clear and unmarked-only bulk attendance remain available. The server resolves the token and checks coach ownership and active enrollment before recording attendance. A successful scan consumes one available session exactly once.

Scanning is native. The browser retains the manual catalog. The official Capacitor scanner uses a bundled Android decoder and the existing iOS SPM setup. The owner approved Android 8 minimum and testing on the connected Galaxy A55 on 2026-09-08.

## Accounting and retries

All attendance writes use one transactional backend operation behind record-attendance. The Edge Function authenticates the caller and supplies the actor ID; clients cannot choose that identity. Direct authenticated table writes are revoked. An operation receipt stores a request ID and payload fingerprint; a retry returns the original outcome without writing again. A reused ID with a different payload is rejected.

Lock each occurrence/child pair and its enrollment before modifying balances. A debit records its original enrollment so absent/clear restores only a debit created by this path. Historical attendance is preserved without retroactive balance changes or invented refunds. Missing, ambiguous or exhausted active enrollments are rejected. Bulk fills only currently unmarked children and must not overwrite a newer manual status.

QR fills an untouched occurrence/child pair. A persistent QR receipt or later manual decision prevents replay from overriding a correction, including a first offline scan submitted after a manual correction. The receipt survives clearing attendance. Corrections remain available in the manual catalog.

## Offline behavior

Persist each captured token with a stable request ID, selected occurrence and capture time before submitting. Keep queues isolated by authenticated coach. Process serially, restore after restart, retry transport/server errors and refresh on reconnect/foreground. Never submit a previous account's operations with another account's session. Definitive rejections remain visible for manual resolution and are not retried automatically. No token is logged or placed in URLs.

Pending is distinct from confirmed attendance. The queue view identifies the course/date, shows pending/rejected counts, permits an explicit retry and explains rejected scans. Server confirmation supplies the child's name. Repeated captures of the same token/occurrence reuse the pending operation.

Queue recovery runs for the authenticated native coach at application level, including the public home route after a restart. A transient profile request failure can retain only the same coach profile already verified in memory during this running session. Cold starts require server profile verification; reconnect and foreground retry it. Sign-out, account changes, definitive permission failures and an updated non-coach role deactivate the prior queue.

## Verification and delivery

Use isolated PostgreSQL fixtures for ownership, enrollment, debit/refund, duplicate/replay, concurrency and rollback tests. Test Edge validation and queue persistence, account switching, lost responses and rejection handling. Preserve existing catalog tests. Run typecheck, lint, tests and build, then browser verification at 375x812 and native camera/permission/offline verification on an available Android runtime. iOS compilation and physical behavior remain explicitly unverified unless an appropriate runtime is available.

Show the native section before proposing final UI criteria. Human criteria, verdict and native verification gates remain human-owned. Apply the reviewed product migration and deploy the function within the authorized feature delivery; do not change tracker schema or publish the entire website. Merge only after required checks, Bugbot and applicable human gates.
