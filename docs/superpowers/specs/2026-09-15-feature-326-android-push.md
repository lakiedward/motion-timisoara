# Feature 326: Android parent notifications

## Approved outcome

The owner approved Android notifications for announcements, attendance changes, and new courses or camps at a child's club. The account explains notification permission before the system prompt, supports opting out, and opens the relevant existing screen on tap. Firebase setup belongs to this task. iOS remains a later stage requiring Apple Developer access; this delivery must not claim iOS verification or silently close that remaining scope.

## Current evidence

The starting revision is `66fc9d89bb898b6829d3d524eb33ad7a46b96328` on `master`. Capacitor Push Notifications 8.1.1 is installed, the Android manifest declares notification permission, and Gradle conditionally applies Google Services. There is no registration flow, device-token table, sender, or Firebase Android configuration. Product Supabase has `pg_cron`, `pg_net`, Vault and a private schema. The announcement feed and attendance authorization paths were inspected, including live RLS.

## Design

The backend records events in the same transaction as their source changes. It expands recipients once, schedules future announcements, leases pending deliveries, and checks current source visibility, active enrollment, profile, session and opt-in before delivery. Event, recipient and device-binding identities prevent creating duplicate jobs. Provider retries are bounded; FCM does not guarantee exactly-once delivery, so Android also deduplicates displayed events. No existing content is backfilled.

The server sends data-only FCM messages with a short expiry. A native FirebaseMessagingService checks the active local binding and expiry before constructing a generic notification, including when the application process has ended normally. This avoids Android automatically displaying a stale notification payload after logout. Force-stop and system delivery restrictions remain operating-system limitations and are tested/documented separately.

The payload contract is string-valued `eventId`, `bindingId`, `kind`, `entityId`, `path`, `title`, `body`, `expiresAt`. `expiresAt` is epoch milliseconds. Native display copy is generic and does not expose children's names, attendance notes or announcement contents on the lock screen. Routes are restricted to `/account/announcements`, `/account/attendance`, `/cursuri/<uuid>` and `/tabere/<slug>`; the application reloads protected data using normal RLS after a tap.

React owns a serial, generation-guarded coordinator for permission, preference, session and token lifecycle. A new binding is issued when the account/session changes or notifications are reactivated. Native clear invalidates pending configuration before logout, clears app notifications and invalidates the FCM token. Global account opt-out is persisted on the server, with explicit retry state when unavailable. No login alone triggers a system permission prompt. A native-only card in the parent account reuses the established Card, Button and Skeleton components.

The native `MotionPush` bridge exposes `configure({bindingId})`, `clear()` and `status()`. Installation identity and binding are private local state excluded from backup. Server RPCs derive user and session from the verified caller rather than accepting a user id: `get_my_push_preferences`, `set_my_push_enabled`, `register_push_device`, `revoke_push_device`. The dispatcher accepts no arbitrary recipient or message from clients. FCM credentials and the dispatcher credential remain server-only.

## Verification and delivery

Run targeted coordinator, permission, routing and sender tests; isolated SQL tests for authorization, scheduling, duplicate/replayed events, rollback, opt-out, session invalidation and retry leases; then application typecheck, lint, test and build. Compile and test the Android native changes.

Use Chrome at 375x812 for the native card and applicable web regression at 1440x900 and 768x1024. Record URLs, screenshots, actions, observed states and console errors. Browser simulations are explicitly labeled and do not count as native delivery evidence. Use the Galaxy A55 for permission refusal/grant, each event type, foreground/background/normal process termination, tap destination, logout, opt-out, account switch, delayed payload and duplicate suppression.

Temporary live fixtures and notification recipients require the owner's consent. Do not notify unrelated parents. Delete only the consented disposable fixtures after verification. Review the final diff, resolve findings and obtain the owner's visual acceptance before merge. Deploy required backend changes within the authorized task; publishing the web app or store build is not implied by this Android implementation request.

## References

- https://capacitorjs.com/docs/apis/push-notifications
- https://firebase.google.com/docs/cloud-messaging/android/receive
- https://firebase.google.com/docs/cloud-messaging/manage-tokens
- https://supabase.com/docs/guides/functions/schedule-functions

## Execution status

Implementation in progress. No completed browser, live push, device, merge or deployment proof is asserted by this design document.
