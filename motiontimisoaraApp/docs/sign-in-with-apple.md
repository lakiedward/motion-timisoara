# Sign in with Apple (feature #324)

App code is ready. **Do not put Apple or Supabase secrets in the repo.** Enable the
provider in Apple Developer + Supabase Auth, then the existing `/login` and
`/register` buttons work.

## Android decision

The «Continuă cu Apple» button is shown on **web** and **iOS native**. It is
**hidden on Android native**.

`@capacitor-community/apple-sign-in` does not support Android. Apple has no
ASAuthorization sheet there. A Capacitor Android WebView OAuth fallback is
fragile (Apple often blocks embedded browsers). Parents on Android already have
email + Google. App Store guideline 4.8 is iOS-only.

## Plugin

Native iOS uses `@capacitor-community/apple-sign-in` (7.1.x, peer `@capacitor/core`
`>=7.0.0`, so Capacitor 8 is in range). It is the Ionic community plugin, recently
released, and it maps `ASAuthorizationAppleIDProvider` plus a SHA-256 `nonce`.
Web does **not** use the plugin: it uses the same
`signInWithOAuth({ provider, redirectTo: …/auth/callback })` path as Google.

Native iOS then calls `supabase.auth.signInWithIdToken({ provider: 'apple', token,
nonce })` with the **raw** nonce. Apple receives the **SHA-256 hex** of that nonce.

## Profile creation

No new migration. `public.handle_new_user` (00034) already:

- inserts `profiles.role = 'PARENT'` for every new `auth.users` row
- sets `name` to `raw_user_meta_data->>'name'` or, if missing, `email`
- leaves `phone` null

Apple may omit name after the first consent and may use a private-relay email.
That is enough: `/auth/callback` already opens «Completează-ți profilul» when
phone is missing (same as Google). On native, if Apple returns given/family name
on first sign-in, the app writes that string onto the existing `profiles.name`
row. It does **not** create a second profile path.

## What Laki must configure

Field names only. Never commit values.

### 1. Apple Developer

- **App ID** `com.motiontimisoara.app` → capability **Sign in with Apple** (no
  server-to-server notification endpoint).
- **Services ID** (web), linked to that App ID.
- Services ID → **Website URLs**:
  - Domains: the Supabase Auth host (`<project-ref>.supabase.co`)
  - Return URL: `https://<project-ref>.supabase.co/auth/v1/callback`
- **Key**: Sign in with Apple, download the `.p8` once, note **Key ID**.
- **Team ID** (10 characters, Apple Developer membership).

### 2. Supabase Auth → Providers → Apple

Do this in the dashboard. This PR does not enable the provider.

- **Client IDs**: Services ID **first**, then the iOS bundle ID
  `com.motiontimisoara.app` (comma-separated). The first ID is the web OAuth
  audience; native `signInWithIdToken` accepts any ID in the list.
- **Secret Key**: JWT generated from the `.p8` + **Key ID** + **Team ID** +
  Services ID. Apple expires this JWT every **6 months** — rotate it or web
  OAuth breaks. Native-only ID token sign-in does not use this JWT, but web
  does.
- Leave nonce checks **enabled**.

### 3. Supabase Auth redirect allow-list

Keep the existing Google/native entries. Add the web app callback if missing:

- `https://motiontimisoara.com/auth/callback`
- `https://motiontimisoara.com/auth/callback**` (returnUrl query)
- `http://127.0.0.1:3017/auth/callback` / `http://127.0.0.1:3017/auth/callback**`
  for local preview
- `com.motiontimisoara.app://auth/callback**` (already used by native Google)

### 4. Xcode

This PR adds `ios/App/App/App.entitlements` with
`com.apple.developer.applesignin = Default` and points
`CODE_SIGN_ENTITLEMENTS` at it. After pulling:

- Signing & Capabilities → confirm **Sign in with Apple**
- Signing team = the Apple Developer team that owns the App ID
- `cap sync` after `npm ci` (CI already runs `npx cap sync ios`)

Simulator compile without signing is covered by App CI (`CODE_SIGNING_ALLOWED=NO`).
A real device/TestFlight run still needs the capability on the App ID.

## How to test locally

### Web (provider still off)

`npm run dev -- --port 3017 --strictPort --host 127.0.0.1`

Open `/login` and `/register`. The Apple button is visible. A click calls
`signInWithOAuth({ provider: 'apple', redirectTo: <origin>/auth/callback… })` —
the same shape as Google. Until the provider is enabled, Apple/Supabase will
reject the authorize URL; that is expected.

### Web (provider enabled)

Same click should reach Apple, return to `/auth/callback`, create a PARENT
profile via `handle_new_user`, then either complete-profile (no phone) or
`/account`.

### iOS simulator (provider enabled)

1. Enable the capability + Client IDs as above.
2. `npm run cap:sync` (or `npx cap sync ios` after a build).
3. Open the iOS app, `/login` or `/register`, tap «Continuă cu Apple».
4. Confirm the system sheet; cancel must show **no** error toast.
5. A real failure uses the same Sonner error pattern as Google.
