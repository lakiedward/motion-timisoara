# Web push for parents on the website

Date: 2026-11-02. Owner request: "fă să meargă notificările și pe site și testează".
The owner launches the website first, so the parent notifications that until now
reached only the Android app must also reach a browser.

## Scope

- Same audience and events as the Android push (feature #326): parents only; course and
  club announcements, attendance changes, a new course or camp at the child's club.
  Payloads stay generic (no announcement text, no child data).
- Browsers: Chrome, Edge, Firefox, Opera and Samsung Internet on desktop and Android;
  Safari on macOS; Safari on iPhone/iPad only after the visitor adds Motion to the home
  screen (Apple rule). Inside the Capacitor app nothing changes.
- Coach, club and admin notifications are out of scope (none exist today).

## Design

- Standard Web Push (RFC 8030/8291/8292) with VAPID, no Firebase web SDK. The public key
  is in `src/api/notifications/web.ts`; the private key is the Supabase secret
  `WEB_PUSH_VAPID_JWK` (P-256 JWK) and never enters the repository.
- `public/push-sw.js` is a push-only service worker (no fetch handler, no caching). It
  validates the payload like the app, shows the notification and, on click, focuses an
  open tab and asks the app to route, or opens the path.
- The browser reuses the existing push coordinator (consent, session binding, sign-out
  isolation). The device token is the compact JSON subscription
  `{"endpoint","keys":{"p256dh","auth"}}`.
- Migration `00110_web_push.sql`: `push_devices.platform` accepts `web`;
  `register_push_device` gets `p_platform` (default `android`, so the Android app is
  unchanged) and validates web subscriptions, limiting endpoints to the HTTPS hosts of
  the Google, Mozilla, Apple and Microsoft push services; `prepare_push_delivery` also
  returns `platform`.
- `dispatch-push` routes `web` deliveries to `webpush.ts` (aes128gcm encryption, ES256
  VAPID, `TTL` from the outbox, redirects refused). 404/410 revoke the device; 429/5xx
  retry; a missing VAPID key retries for later without contacting the push service.
- `public/manifest.webmanifest` (display standalone) makes the iPhone home-screen app
  eligible for push. The account card tells iPhone Safari visitors to add Motion first.

## Verification

- Isolated SQL (`supabase/tests/push-web.sql`), Deno contracts
  (`dispatch-push-web.test.ts`, encryption also decrypted with the independent
  `http_ece` library), Vitest for the browser adapter, listener and card.
- Live: after the migration, function deploy and secret, a real browser subscribed on
  master-- receives a notification for a test announcement on the QA parent's course.
