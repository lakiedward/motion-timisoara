# Motion Timisoara - Triathlon Team Platform

## Project Overview
Platform for managing triathlon & multi-sport clubs for kids. Parents enroll children in courses, manage payments, view calendars and announcements. Coaches manage courses, attendance, photos, and announcements. Club owners manage their club, coaches, and revenue. Admins have full control.

**Status**: React rebuild in progress on Supabase. Phases 1–4 done (foundation, design system, public site, auth); phases 5–10 (parent/account, coach, club, admin, hardening, native packaging) still open — see `docs/superpowers/plans/2026-06-15-rebuild-plan-index.md` for the live roadmap and `docs/react-rebuild/feature-parity-inventory.md` for what the old app did.

**Not deployed.** `www.motiontimisoara.com` currently returns a Railway "Application not found" 404. There is no production web deploy for either the React app or the retired Angular app.

**Domain**: motiontimisoara.com

## Monorepo Structure
```
motion-timisoara/
├── motiontimisoaraApp/      # ← THE APP. React 19 + Vite + Capacitor (web + iOS + Android)
├── supabase/                # Backend: migrations, Edge Functions, seed
│   ├── migrations/          # PostgreSQL schema migrations (00001–00019)
│   ├── functions/           # Deno Edge Functions
│   └── seed/                # One-shot data migration from the retired Spring Boot DB
├── tests/                   # Playwright E2E (root-level, points at a running app)
├── docs/                    # Live rebuild roadmap + feature parity inventory
├── TriathlonTeamFE/         # [LEGACY] Angular 20 + SSR — frozen, superseded, not deployed
├── TriathlonTeamMobile/     # [LEGACY] Expo/React Native — superseded by Capacitor
├── TriathlonTeamBE/         # [ARCHIVED] Kotlin Spring Boot — retired, kept for reference
├── _archive-docs/           # Historical docs & scripts from the Spring Boot era
├── playwright.config.ts     # E2E test config
├── .github/workflows/       # app-ci.yml (the real gate) + playwright.yml
├── AGENTS.md                # Cursor Cloud / test-account notes
└── CLAUDE.md                # This file
```

> **Do NOT delete `TriathlonTeamBE/`** — it is the reference for the original API contracts and business logic.
>
> `TriathlonTeamFE/` and `TriathlonTeamMobile/` are frozen and referenced by nothing, but stay until the parity phases close: the Angular code is the spec for the screens not rebuilt yet. Do not add features to them.

---

## The app (`motiontimisoaraApp/`)

**Stack**: React 19 · TypeScript · Vite · Tailwind CSS 4 · Radix UI (shadcn-style) · React Router 7 · TanStack Query 5 · react-hook-form + Zod · @supabase/supabase-js · Stripe.js · Leaflet · Capacitor 8 (iOS + Android) · Vitest + Testing Library

One codebase ships three targets: the website, the iOS app, and the Android app. Capacitor wraps the same Vite build (`webDir: dist`, appId `com.motiontimisoara.app`).

### Key paths
| Path | What lives there |
|------|------------------|
| `src/routes/router.tsx` | The whole route table (~63 routes), one file |
| `src/routes/guards.tsx` | `RequireAuth` and role gates |
| `src/layout/` | `CoreLayout` (public), `PortalLayout` (signed-in), Header, Footer, FabAccount |
| `src/features/public/` | Home, program, courses, camps, activities, coaches, clubs, map, about, contact |
| `src/features/auth/` | Login, register, coach/club signup wizards, OAuth callback, forgot/reset password |
| `src/features/account/` | Parent portal: children, enrollments, attendance, announcements, checkout |
| `src/features/coach/` | Coach portal: courses, activities, attendance catalog, locations, own profile, Stripe setup |
| `src/features/billing/` | `StripeOnboardingPanel` — the Connect setup screen shared by club and coach, and the target of Stripe's four return URLs |
| `src/features/club/` | Club portal: dashboard, coaches, courses, locations, announcements, Stripe |
| `src/features/admin/` | Admin: users, courses, clubs, sports, invite codes |
| `src/api/` | One module per domain — all Supabase access lives here, not in components |
| `src/lib/` | `supabase.ts`, `query.ts`, `auth-context.tsx`, `stripe.ts`, `platform.ts`, `money.ts`, `utils.ts`, `database.types.ts` |
| `src/components/ui/` | Radix-based primitives (button, card, input, sheet, dropdown-menu, …) |
| `src/test/setup.ts` | Vitest setup, wired via `vite.config.ts` |

`@/` is aliased to `src/` (see `vite.config.ts`).

### Architecture
- **Data access**: components never call Supabase directly. Each `src/api/*.ts` module exposes typed functions; screens consume them through TanStack Query. `queryClient` defaults: `staleTime` 30s, `retry` 1, no refetch on focus.
- **Auth**: `src/lib/auth-context.tsx` holds the session and the `profiles` row as `AppUser`. Route protection is `RequireAuth` + role gates in `src/routes/guards.tsx`.
- **Session storage**: web uses supabase-js localStorage; native persists into Capacitor Preferences (`src/lib/supabase.ts` swaps the storage adapter via `isNative()`).
- **Money**: all amounts are stored in the DB as minor units (bani). Convert only at the edges with `baniToRon` / `ronToBani` from `src/lib/money.ts`.
- **Stripe**: `src/lib/stripe.ts` lazily loads Stripe and resolves to `null` when no publishable key is set, so checkout degrades to cash-only instead of crashing.
- **Types**: `src/lib/database.types.ts` is the generated Supabase schema. Regenerate it after any migration.

### Run locally
```bash
cd motiontimisoaraApp
npm ci
cp .env.example .env      # then fill in the values
npm run dev               # http://127.0.0.1:5173 (preview config uses 3017)
npm run typecheck         # tsc --noEmit
npm run lint              # eslint
npm test                  # vitest run
npm run build             # tsc -b && vite build
npm run cap:sync          # build + sync into the native projects
npm run android           # build + sync + open Android Studio
```

`.claude/launch.json` starts the app as **`motion-react`** on port **3017** — that is the port the E2E suite expects.

### CI
`.github/workflows/app-ci.yml` runs on any push touching `motiontimisoaraApp/**`: `npm ci`, `typecheck`, `lint`, `test`, `build`. This is the gate that matters — keep it green.

### Code style
Prettier (see `.prettierrc.json`), ESLint flat config with `react-hooks` and `react-refresh`. Tailwind utility classes composed with `cn()` from `src/lib/utils.ts`.

---

## Backend (Supabase)

**Stack**: hosted PostgreSQL with RLS · Supabase Auth · Storage · Realtime · Deno Edge Functions · Stripe

Project ref: **`ehdzafadshbaaghzdzdo`** (see `supabase/config.toml`).

### Auth
- Email/password and Google OAuth via Supabase Auth.
- User profiles live in `profiles`, kept in sync from `auth.users` by a trigger.
- Roles: `PARENT`, `COACH`, `CLUB`, `ADMIN` (in `profiles.role`).
- No custom JWT, no CSRF tokens, no cookie auth — supabase-js manages bearer tokens.

### Data access
Clients query PostgREST directly (`supabase.from('table')`); RLS enforces authorization in the database. Anything RLS cannot express becomes an Edge Function.

### Migrations
`supabase/migrations/00001` … `00019`. See `supabase/migrations/README.md` for the mapping between file numbers and the `version` values recorded on the remote — `00015`–`00019` were applied to the remote first and backfilled into git on 2026-08-20.

**Next migration number = highest existing + 1.** Check before writing one:
```bash
git ls-files supabase/migrations | tail -1
```
Never trust a number written down anywhere else, including in this file.

Rules: always add RLS policies for new tables; `uuid` primary keys via `gen_random_uuid()`; `timestamptz` for all timestamps; PostgreSQL enums for enumerations; explicit `ON DELETE` on foreign keys.

### Edge Functions
13 functions are tracked in `supabase/functions/`; **10 are deployed**. Deployment status is not visible from the source tree, so check it rather than assuming.

| Function | Deployed | Description |
|----------|:--------:|-------------|
| `register-coach` | ✅ | Coach registration with invitation code |
| `register-club` | ✅ | Club registration |
| `create-managed-coach` | ✅ | Club creates a coach account it manages |
| `contact-form` | ✅ | Public contact form submission |
| `validate-enrollment` | ✅ | Pre-checkout eligibility check |
| `create-enrollment` | ✅ | Enrollment creation (courses, camps, activities) |
| `cancel-draft-enrollment` | ✅ | Rolls back PENDING drafts when checkout fails or is abandoned |
| `create-payment-intent` | ✅ | Stripe PaymentIntent for an enrollment |
| `stripe-webhook` | ✅ | Stripe payment webhooks |
| `mark-cash-paid` | ✅ | Marks an enrollment paid by cash — **no client calls it yet** |
| `stripe-connect` | ❌ | Connect account status / onboarding / dashboard links. **Called from live routes** (`src/api/stripe-connect.ts`), so club and coach Stripe onboarding stay broken until this is deployed and `FRONTEND_URL` is set. Returns 503 with `code: stripe_not_configured` when `STRIPE_SECRET_KEY` is missing, which the app renders as a setup-pending state. |
| `stripe-connect-webhook` | ❌ | Stripe Connect webhooks |
| `record-attendance` | ❌ | Holds the **only** implementation of session-package deduction. The app writes attendance straight to the table and skips that accounting. Do not delete — deploy it or port the logic into a trigger. |

Conventions: one function per directory (`supabase/functions/<name>/index.ts`); shared helpers in `_shared/` (`cors.ts`, `stripe.ts`, `supabase.ts`); service-role client for admin work, the caller's JWT for user-scoped work; JSON responses with real status codes; CORS via `_shared/cors.ts`.

### Main tables
profiles, children, courses, course_occurrences, activities, camps, clubs, enrollments, attendance, payments, monthly_payments, invoices, coach_profiles, coach_invitation_codes, club_invitation_codes, locations, user_recent_locations, sports, course_photos, course_announcements, course_announcement_attachments, club_announcements, course_ratings, coach_ratings, user_announcement_views, audit_log, coach_sports, club_sports, club_coaches

### Enums
enrollment_kind (COURSE/CAMP/ACTIVITY), enrollment_status, payment_status, payment_method, payment_recipient_type (COACH/CLUB), attendance_status, role (ADMIN/CLUB/COACH/PARENT), location_type, announcement_attachment_type, invoice_status, invoice_type, issuer_type

### Storage
Buckets are defined in `00004_storage_buckets.sql` and `00016_sport_default_photo.sql`. **All buckets are currently empty and the app has no upload path** — every course/coach/club image falls back to a placeholder. `src/api/public.ts` only ever calls `getPublicUrl`.

### Local development
```bash
npx supabase link --project-ref ehdzafadshbaaghzdzdo
npx supabase start              # local stack (needs Docker)
npx supabase functions serve    # http://localhost:54321/functions/v1/<name>
npx supabase migration list     # compare git against the remote
```
Point the app at the local stack by setting `VITE_SUPABASE_URL=http://127.0.0.1:54321` in `motiontimisoaraApp/.env`.

---

## Legacy trees

Frozen. Nothing in the active product imports them and no workflow builds them. They stay only as reference until the parity phases close.

| Tree | Was | Superseded by |
|------|-----|---------------|
| `TriathlonTeamFE/` | Angular 20 + SSR web app | `motiontimisoaraApp/` |
| `TriathlonTeamMobile/` | Expo / React Native app | Capacitor inside `motiontimisoaraApp/` |
| `TriathlonTeamBE/` | Kotlin Spring Boot API + PostgreSQL | Supabase (RLS + Edge Functions) |

`TriathlonTeamFE/public/ui-backup/` used to hold 226 MB of unoptimized original club photos — 79% of everything tracked here — alongside a 26 MB set of resized `.jpg` twins in `public/ui/`. Both were removed from HEAD on 2026-08-20, dropping tracked content from 286 MB to 33 MB; the `.webp` set stays. **Clone size has not moved**: the blobs are still reachable in history, and only a `git filter-repo` pass plus a force-push will reclaim them. That rewrite is still owed, and should be done once — together with scrubbing the credentials described below.

`supabase/seed/migrate-data.ts` was the one-shot import from the Spring Boot database. Its job is finished; it is kept next to `TriathlonTeamBE/` for the same reason that tree is kept.

---

## E2E tests (root level)

Playwright, in `tests/`:
- `smoke-tests.spec.ts` — homepage, assets, JS errors, performance
- `production-readiness.spec.ts` — user flows, security headers, responsive design, error handling
- `helpers/target.ts` — shared "am I running against the local preview" check

Base URL comes from `BASE_URL`, defaulting to `https://www.motiontimisoara.com` — which is currently a 404, so **runs without `BASE_URL` fail by design**. Point it at a running app:

```bash
npx playwright test          # uses BASE_URL, or production by default
```

`.github/workflows/playwright.yml` runs on every push to master with no `BASE_URL` and no `paths:` filter, so it is currently red on every push, including documentation-only ones.

---

## Environment variables

### `motiontimisoaraApp/.env` (see `.env.example`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/publishable key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | No | Without it, checkout degrades to cash-only |

Vitest injects its own `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (see `vite.config.ts`), so tests need no `.env`.

### Supabase project secrets (Edge Functions)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Yes | Injected by the platform |
| `STRIPE_SECRET_KEY` | For payments | |
| `STRIPE_WEBHOOK_SECRET` | For payments | Webhook signature verification |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | For Connect | |
| `FRONTEND_URL` | For Connect | Base for the Stripe return URLs. Unset today; the code default is the local dev origin, which is wrong for anything but local work. |

---

## Common tasks

**Add a page**: create the component under `src/features/<area>/` → add the route in `src/routes/router.tsx` → put the data access in a `src/api/*.ts` module and consume it with TanStack Query → add navigation.

**Add a table**: `git ls-files supabase/migrations | tail -1` to get the next number → write `supabase/migrations/000NN_<desc>.sql` with RLS policies → apply → regenerate `src/lib/database.types.ts`.

**Add a column**: new migration with `ALTER TABLE` → update RLS if needed → regenerate types → update forms and views.

**Add an Edge Function**: create `supabase/functions/<name>/index.ts` using `_shared/` → `npx supabase functions deploy <name>` → call it from a `src/api/*.ts` module. Deploying is a separate act from committing; the table above tracks which functions are actually live.

**Change the schema**: never edit an applied migration. Migrations are an append-only ledger.

---

## Debugging quick reference

- **Auth errors**: check `supabase.auth.getSession()`, then that the `profiles` row exists for that user id.
- **Empty results or 403**: almost always RLS. Check the policies on the table, that `auth.uid()` is who you expect, and the caller's `profiles.role`.
- **Edge Function errors**: Supabase Dashboard → Edge Functions → Logs, or `npx supabase functions serve` locally. If a function seems to do nothing, check it is deployed at all.
- **Native-only bugs**: `isNative()` / `platform()` from `src/lib/platform.ts`. Session storage differs between web and native.
- **Stripe**: check Edge Function logs, webhook signatures, and that the secrets are set on the project.
- **Schema drift**: `npx supabase migration list` compares git against the remote.
- **CI red**: `app-ci.yml` is the real signal. `playwright.yml` is red for an unrelated reason (it targets a 404 domain).
