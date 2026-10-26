# Checkout acceptance log (feature #554)

## Goal

Keep proof of what a parent accepted when placing an enrollment: the account, the terms of service version and SHA-256, the offer rules (text or file) SHA-256, the enrollments and the UTC time. The legal research of 2026-10-21 treats the checkout checkbox as a valid simple electronic signature only if this proof exists. The confirmation email with the accepted documents is out of scope (it needs an email service).

## Design

- `public.checkout_acceptances` (migration 00102) is append-only: RLS lets the parent read their rows and ADMIN read all; only `service_role` may insert; triggers refuse UPDATE, DELETE and TRUNCATE for every role; `user_id` is `ON DELETE RESTRICT` so a profile with records cannot be removed by accident.
- `create-enrollment` calls `save_enrollment_batch_with_acceptance()`, which runs the existing `save_enrollment_batch()` and inserts the record in the same transaction. The existing function is not replaced.
- The server owns every recorded value. Terms: `supabase/functions/_shared/terms-version.ts` holds `TERMS_VERSION` and the SHA-256 of the rendered `/termeni` text; a Vitest test fails when the page text changes without a new version and hash. Rules: the server reads the offer row; a file is downloaded from its bucket and its bytes are hashed, otherwise the trimmed camp rules text is hashed.
- The client sends the terms version it showed and a rules fingerprint (`file:<path>`, `text:<sha256>` or `none`). A mismatch returns 409 `TERMS_CHANGED` / `RULES_CHANGED` and the wizard asks for consent again, like `PRICE_CHANGED`. Older clients that send nothing still get a server-side record (`client_terms_version` NULL).
- An unreadable rules file blocks the enrollment (503) rather than recording consent to a document the server could not verify.

## Release order

Apply 00102, deploy `create-enrollment`, then merge the client. The function stays compatible with the published client.
