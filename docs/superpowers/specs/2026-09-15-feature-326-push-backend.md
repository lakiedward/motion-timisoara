# Android push delivery backend — feature 326

The approved Android stage sends generic notifications for announcements, attendance changes, and newly published club courses/camps. iOS is outside this stage. The Android service validates the current binding before showing data-only FCM messages, including while JavaScript is stopped.

## Authenticated application contract

- `get_my_push_preferences()` returns `{ "enabled": boolean }`, default false.
- `set_my_push_enabled(p_enabled boolean)` returns the saved preference. Disabling revokes every current device binding for that parent.
- `register_push_device(p_installation_id uuid, p_binding_id uuid, p_token text)` returns void. Registration requires an enabled PARENT profile, a live matching `auth.sessions` row from the JWT `session_id`, and enabled preferences. A fresh binding UUID is required after revocation; token refresh within one binding is allowed.
- `revoke_push_device(p_binding_id uuid)` returns void and is idempotent for the caller's own binding. An expired/removed session cannot register again; revocation remains possible with an unexpired JWT belonging to the binding owner.

Preferences and device metadata have RLS; client writes go only through narrowly scoped RPCs. Tokens, events and deliveries cannot be selected directly by application users. Installation/token replacement revokes prior bindings. The client removes its binding from native storage immediately during logout/disable, then attempts server revocation before sign-out. A persisted revocation receipt can retry later while the native binding filter already prevents display; backend session validation supplies a second boundary after session revocation.

## Event and delivery contract

Append-only triggers enqueue events in the source transaction. Existing records receive no notification backfill. Source edits update/cancel an existing unsent announcement event; they do not manufacture a new notification for historical content. Club announcements honor publication and expiry timestamps. A private first-publication register records currently active club courses during migration without sending messages. Inactive courses and courses without a club create no dormant queue entries; their first eligible activation/club assignment publishes once for the club at that time. This includes a draft inactive when the migration was applied. The register remains until its course is deleted, so outbox retention cannot cause repeat publication. A camp is published by its first successful insert because the current schema has no publication status.

The minute dispatcher expands due events once into unique event/user/binding deliveries, only for enabled parents with a current binding and an ACTIVE enrollment in the matching audience. Multiple children do not duplicate a delivery. Attendance changes invalidate earlier unsent events for that attendance identity; identical writes produce no event. Source eligibility and enrollment access are checked during expansion, claim and immediately before sending.

Claims use `FOR UPDATE SKIP LOCKED`, a fresh lease UUID and a bounded batch. Leases expire after two minutes; attempts are bounded at five with exponential retry delays. Outcomes distinguish sent, skipped, retry and dead letters. FCM acceptance is not proof of display. Network uncertainty may cause transport retry; the event ID permits native deduplication. Invalid tokens revoke the matching binding. Session deletion/expiry, opt-out, child ownership changes and source withdrawal stop unsent delivery.

FCM carries only string fields `eventId`, `bindingId`, `kind`, `entityId`, `path`, `title`, `body`, `expiresAt`. Kind is announcement/attendance/course/camp. Routes are server-generated allowlisted relative paths; camp routes use the current slug. Titles and bodies are fixed Romanian text, without child names or private announcement content. TTL is capped by the event expiry and one hour per send.

`expiresAt` is an epoch-milliseconds decimal string. Existing camp slugs accept lowercase ASCII letters, digits and hyphens (minimum three characters); a slug longer than 2000 characters uses `/tabere` to keep FCM data below its transport limit. Every minute, the invoker removes at most 500 expired/cancelled events older than 30 days, 500 device records inactive for 30 days, and 500 revocation receipts older than 30 days. Event deletion cascades to deliveries, including dead letters. The durable course publication register has at most one small row per published course and cascades on course deletion.

## Privileged execution and validation

`dispatch-push` accepts only POST with the constant-time checked `x-push-dispatch-secret`; request bodies cannot specify recipients or messages. The FCM service account JSON and dispatch secret are Edge secrets. The private cron invoker reads its dispatch secret from Vault and calls the fixed product function URL through pg_net. Missing secrets prevent dispatch without breaking product writes.

SQL tests run in a network-isolated disposable PostgreSQL container. They cover authorization, ownership, session revocation, preference revocation, token replacement, audience isolation, scheduling, expiry, duplicate suppression, transactional rollback, leases and retries. Deno tests use injected HTTP/RPC dependencies for authentication, payload validation, retries, Google OAuth signing and secret-safe failures. The real Android permission, killed-app delivery and tap behavior remain separate device verification.

References: [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), [scheduled Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api).
