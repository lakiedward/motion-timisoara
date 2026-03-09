# Motion Timisoara - Triathlon Team Platform

## Project Overview
Platform for managing triathlon & multi-sport clubs for kids. Parents enroll children in courses, manage payments, view calendars and announcements. Coaches manage courses, attendance, photos, and announcements. Club owners manage their club, coaches, and revenue. Admins have full control.

**Status**: Testing phase (Supabase migration in progress) | **Domain**: motiontimisoara.com (planned)

## Monorepo Structure
```
motion-timisoara/
├── supabase/                # Supabase backend (migrations, Edge Functions, seed)
│   ├── migrations/          # PostgreSQL schema migrations (00001–00004)
│   ├── functions/           # Deno Edge Functions (business logic)
│   └── seed/                # Data migration script from Spring Boot
├── TriathlonTeamFE/         # Angular 20.3 + SSR
├── TriathlonTeamMobile/     # Expo + React Native 0.81 (React 19)
├── TriathlonTeamBE/         # [ARCHIVED] Kotlin Spring Boot 3.5.5 — retired, kept for reference
├── tests/                   # Playwright E2E tests (root-level)
├── src/                     # Root-level static assets (minimal)
├── _archive-docs/           # Historical docs & summaries
├── playwright.config.ts     # E2E test config
├── .github/workflows/       # CI/CD (Playwright)
└── CLAUDE.md                # This file
```

> **Note**: `TriathlonTeamBE/` is the original Kotlin Spring Boot backend. It is archived and no longer actively developed. All backend functionality has been migrated to Supabase. Do NOT delete this directory — it serves as a reference for the original API contracts and business logic.

---

## Backend (Supabase)

**Stack**: Supabase (hosted PostgreSQL with RLS) · Supabase Auth · Supabase Storage · Supabase Realtime · Deno Edge Functions · Stripe

Supabase replaces the Spring Boot backend entirely. Auth, database access, storage, real-time subscriptions, and server-side business logic are all handled by Supabase services and Edge Functions.

### Key Paths
- **Schema migrations**: `supabase/migrations/` (00001–00004)
- **Edge Functions**: `supabase/functions/` (Deno TypeScript)
- **Shared utilities**: `supabase/functions/_shared/` (cors.ts, stripe.ts, supabase.ts)
- **Data migration**: `supabase/seed/migrate-data.ts`

### Migrations
| File | Description |
|------|-------------|
| `00001_schema.sql` | Core tables, enums, and relationships |
| `00002_functions_and_triggers.sql` | Database functions and triggers |
| `00003_rls_policies.sql` | Row Level Security policies for all tables |
| `00004_storage_buckets.sql` | Supabase Storage bucket configuration |

### Edge Functions
Edge Functions handle business logic that cannot be expressed as simple RLS-gated queries. Each function runs on Deno and is invoked via `supabase.functions.invoke()` from clients.

| Function | Description |
|----------|-------------|
| `register-coach` | Coach registration with invitation code validation |
| `register-club` | Club registration |
| `create-enrollment` | Enrollment creation (courses, camps, activities) |
| `cancel-enrollment` | Enrollment cancellation |
| `create-payment-intent` | Creates Stripe PaymentIntent for enrollment |
| `stripe-webhook` | Handles Stripe payment webhooks |
| `stripe-connect-webhook` | Handles Stripe Connect webhooks |
| `mark-cash-paid` | Marks an enrollment as paid by cash |
| `stripe-connect` | Stripe Connect account management (status, onboarding, dashboard links) |
| `record-attendance` | Records attendance for course sessions |
| `contact-form` | Public contact form submission |

### Shared Utilities (`supabase/functions/_shared/`)
- `cors.ts` — CORS headers for Edge Functions
- `stripe.ts` — Stripe client initialization
- `supabase.ts` — Supabase admin client for Edge Functions

### Auth
- Supabase Auth handles all authentication (email/password, OAuth with Google)
- User profiles stored in a `profiles` table synced via triggers from `auth.users`
- Roles: PARENT, COACH, CLUB, ADMIN (stored in `profiles.role`)
- Session management handled by `@supabase/supabase-js` (access + refresh tokens, auto-refresh)
- No custom JWT, no CSRF tokens, no cookie-based auth

### Data Access
- Clients query Supabase PostgreSQL directly via `supabase.from('table')` (PostgREST)
- Row Level Security (RLS) enforces authorization at the database level
- Complex operations use Edge Functions
- No REST API controllers — RLS policies replace role-based endpoint guards

### Key Integrations
- **Stripe**: Payments + Connect (coach/club revenue sharing) via Edge Functions
- **Supabase Storage**: Photo/file storage with signed URLs (replaces S3/Railway)
- **Supabase Realtime**: Real-time notifications via channels (replaces STOMP/SockJS WebSocket)
- **Supabase Auth**: Email/password + Google OAuth (replaces custom JWT + Spring Security)

### Main Tables
profiles, children, courses, course_occurrences, activities, camps, clubs, enrollments, attendance, payments, monthly_payments, invoices, coach_profiles, coach_invitation_codes, club_invitation_codes, locations, user_recent_locations, sports, course_photos, course_announcements, course_announcement_attachments, club_announcements, course_ratings, coach_ratings, audit_log, coach_sports, club_sports, club_coaches

### Enums
enrollment_kind (COURSE/CAMP/ACTIVITY), enrollment_status, payment_status, payment_method, payment_recipient_type (COACH/CLUB), attendance_status, role (ADMIN/CLUB/COACH/PARENT), location_type, announcement_attachment_type, invoice_status, invoice_type, issuer_type

### Data Migration
`supabase/seed/migrate-data.ts` — TypeScript script to migrate data from the Spring Boot PostgreSQL database to Supabase. Run once during the migration phase.

---

## Frontend (TriathlonTeamFE)

**Stack**: Angular 20.3 · TypeScript 5.9 · Angular Material 20.2 · Angular SSR · RxJS 7.8 · @supabase/supabase-js · Stripe.js 7.9 · Leaflet 1.9

### Key Paths
- **Features**: `src/app/features/` (13 feature areas)
- **Core**: `src/app/core/` (guards, services, layout components, models, tokens, errors)
- **Shared**: `src/app/shared/` (components, directives, pipes, services, utils, styles)
- **Routes**: `src/app/app.routes.ts`
- **Supabase config**: `src/index.html` → `<meta name="supabase-url">` and `<meta name="supabase-anon-key">`
- **SSR server**: `server.ts`

### Architecture Changes (Post-Migration)
- **SupabaseService** (`core/services/supabase.service.ts`) wraps `@supabase/supabase-js` and is the central data access layer
- **AuthService** uses Supabase Auth (`signInWithPassword`, `signUp`, `signInWithOAuth`) instead of custom JWT cookies
- **PublicApiService** queries Supabase tables directly via `supabase.from('table')` instead of `HttpClient`
- **WebSocketService** uses Supabase Realtime channels instead of STOMP/SockJS
- **Interceptors removed**: `BaseUrlInterceptor`, `AuthInterceptor`, `CsrfInterceptor` are no longer needed (Supabase JS client handles auth headers automatically). Only `LoadingInterceptor` and `HttpErrorInterceptor` remain for any residual HTTP calls.
- **Tokens**: `SUPABASE_URL` and `SUPABASE_ANON_KEY` injection tokens replace the old `API_BASE_URL` token
- **No `withCredentials`**: Supabase auth uses bearer tokens managed by the JS client, not cookies

### Feature Modules
| Feature | Path | Description |
|---------|------|-------------|
| `home` | `features/home/` | Public landing page |
| `static` | `features/static/` | About, contact pages |
| `auth` | `features/auth/` | Login, register, coach/club signup, OAuth, forgot/reset password |
| `program` | `features/program/` | Course browsing, details, map view, filtering |
| `activities` | `features/activities/` | Activity/workshop browsing |
| `camps` | `features/camps/` | Camp list and detail |
| `coaches` | `features/coaches/` | Public coach profiles |
| `clubs` | `features/clubs/` | Public club directory |
| `account` | `features/account/` | Parent dashboard, children, enrollments, calendar, attendance, announcements, checkout |
| `coach` | `features/coach/` | Coach dashboard, courses, activities, attendance, announcements, locations, Stripe onboarding |
| `club` | `features/club/` | Club dashboard, profile, coaches, courses, locations, announcements, Stripe onboarding |
| `admin` | `features/admin/` | Full admin panel (users, courses, camps, activities, clubs, coaches, locations, sports, payments, attendance, reports, settings) |
| `not-found` | `features/not-found/` | 404 page |

### Core Services
- `supabase.service.ts` — Supabase client wrapper (auth, from, storage, channel, invokeFunction)
- `auth.service.ts` — Authentication via Supabase Auth, profile loading from `profiles` table
- `public-api.service.ts` — Public data queries via Supabase PostgREST
- `websocket.service.ts` — Real-time notifications via Supabase Realtime channels
- `error-reporting.service.ts`, `geocoding.service.ts`, `location.service.ts`, `notification.service.ts`, `rating.service.ts`

### Guards
- `auth.guard.ts` — Checks Supabase session via `AuthService.me()`
- `role.guard.ts` — Role-based route protection using profile data

### Shared Components
`form-error`, `lightbox`, `loader-overlay`, `location-picker`, `premium-confirm-dialog`, `rating-dialog`, `skeleton-loader`, `star-rating`, `video-embed`, `toast-container`

### Core Layout Components
`core-layout`, `header`, `footer`, `fab-account`

### State Management
RxJS BehaviorSubject (no NgRx). Auth state in `AuthService`, feature-specific state in feature services. Supabase Auth state changes drive the `currentUser$` observable via `onAuthStateChange`.

### Run Locally
```bash
cd TriathlonTeamFE
npm ci
npm start            # dev server on http://localhost:4200 (uses dotenv -e .env.local)
npm start:ssl        # dev server with SSL
npm run build        # production build with SSR
npm test             # Karma + Jasmine
npm run lint:content # content validation script
npm run optimize:images # image optimization via sharp
```

### Supabase Configuration
Update meta tags in `src/index.html`:
- `<meta name="supabase-url" content="https://your-project.supabase.co">`
- `<meta name="supabase-anon-key" content="your-anon-key-here">`

For SSR, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables (read by `app.config.ts` factory).

### Code Style
Prettier configured: 100 char width, single quotes, Angular HTML parser.

---

## Mobile App (TriathlonTeamMobile)

**Stack**: Expo · React Native 0.81.5 · React 19 · TypeScript 5.9 · @supabase/supabase-js · Stripe React Native 0.50.3 · React Navigation · Expo Secure Store

### Key Paths
- **Entry**: `App.tsx` (AuthProvider -> NavigationContainer -> RootNavigator)
- **API layer**: `app/api/` (API clients using Supabase JS client)
- **Features**: `app/features/` (auth, admin, coach, parent — organized by role)
- **Navigation**: `app/navigation/` (10 navigators, role-based tab structure)
- **Components**: `app/components/coach/` (shared coach UI components)
- **Config**: `app/config/` (env.ts with SUPABASE_URL + SUPABASE_ANON_KEY, theme.ts)
- **State**: `app/store/AuthContext.tsx` (Context API for auth)

### Architecture
- Uses `@supabase/supabase-js` instead of Axios for all backend communication
- Auth tokens stored in Expo Secure Store, passed to Supabase client
- API clients query Supabase tables directly and invoke Edge Functions for complex operations
- Supabase Realtime for push notifications and live updates
- Config in `app/config/env.ts`: `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### Navigation Hierarchy
```
RootNavigator
├── AuthNavigator (login)
└── MainNavigator (role-based)
    ├── AdminTabsNavigator (dashboard)
    ├── CoachTabsNavigator (attendance, courses, sessions, announcements, payments)
    └── ParentTabsNavigator (home, schedule, children, enrollments, payments, announcements, profile)
```

---

## E2E Tests (Root Level)

**Stack**: Playwright · Chromium/Firefox/WebKit

### Test Suites (`tests/`)
- `smoke-tests.spec.ts` — Quick validation (homepage, assets, JS errors, SSL, performance)
- `production-readiness.spec.ts` — Comprehensive production checks (user flows, security headers, performance, responsive design, data integrity, error handling)
- `example.spec.ts` — Basic Playwright examples

### Config
- Base URL: `process.env.BASE_URL` (default: `https://www.motiontimisoara.com`)
- CI: 2 retries, single worker, screenshots on failure, video on retry
- Timeouts: 60s test, 15s action, 30s navigation

### CI/CD
`.github/workflows/playwright.yml` — Runs on push to main/master and PRs. Uploads HTML report artifact (30-day retention).

---

## Development Workflows

**Frontend local**: Run `npm start` in `TriathlonTeamFE/`. Configure Supabase URL and anon key in `src/index.html` meta tags (point to your Supabase project or local Supabase instance).

**Frontend + local Supabase**: Run `supabase start` (requires Supabase CLI and Docker) for a local Supabase instance. Update meta tags to point at `http://localhost:54321`. Then `npm start` in `TriathlonTeamFE/`.

**Mobile**: Run `npx expo start` in `TriathlonTeamMobile/`. Configure `app/config/env.ts` with `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

**Edge Functions local dev**: Run `supabase functions serve` to test Edge Functions locally. Functions will be available at `http://localhost:54321/functions/v1/<function-name>`.

**Data migration**: Run `supabase/seed/migrate-data.ts` to migrate data from the old Spring Boot PostgreSQL database to Supabase (one-time operation).

---

## Coding Conventions

### Supabase (Edge Functions)
- Written in TypeScript, run on Deno
- One function per directory: `supabase/functions/<name>/index.ts`
- Shared code in `supabase/functions/_shared/`
- Use `createClient` from `@supabase/supabase-js` with service role key for admin operations
- Use the user's JWT (from `Authorization` header) for user-scoped operations
- Return JSON responses with appropriate HTTP status codes
- Handle CORS via shared `cors.ts`

### Database
- Schema changes go in new migration files: `supabase/migrations/00005_<desc>.sql` (next number is 00005)
- Always define RLS policies for new tables
- Use PostgreSQL enums for type-safe enumeration columns
- Use `uuid` primary keys (generated by `gen_random_uuid()`)
- Use `timestamptz` for all timestamp columns
- Foreign keys with appropriate ON DELETE behavior

### Frontend (Angular)
- Feature modules lazy-loaded per route
- Standalone components preferred
- Component naming: `my-thing.component.ts`
- Component-scoped SCSS styles
- Use `isPlatformBrowser()` for browser-only code (SSR safety)
- `OnPush` change detection + `trackBy` for lists
- Use `SupabaseService` for all data access — do not use `HttpClient` for backend calls
- Wrap Supabase async calls with `from()` to convert to Observables where needed
- Prettier: 100 char width, single quotes

### Mobile (React Native)
- Feature-first organization by user role
- Custom hooks (`useXyz`) for screen logic
- Centralized API clients in `app/api/` using `@supabase/supabase-js`
- Theme constants in `app/config/theme.ts`
- Context API for global state (no Redux)

---

## Environment Variables

### Supabase Project
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL (e.g., `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (Edge Functions) | Service role key for admin operations in Edge Functions |
| `STRIPE_SECRET_KEY` | No | Stripe payments (used in Edge Functions) |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature verification |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | No | Stripe Connect webhook signature verification |

### Frontend (Angular)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Set via `<meta name="supabase-url">` in `index.html` or env var for SSR |
| `SUPABASE_ANON_KEY` | Yes | Set via `<meta name="supabase-anon-key">` in `index.html` or env var for SSR |

### Mobile (React Native)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Set in `app/config/env.ts` |
| `SUPABASE_ANON_KEY` | Yes | Set in `app/config/env.ts` |

---

## Common Tasks

**Add new Edge Function**: Create `supabase/functions/<name>/index.ts` → implement handler → deploy with `supabase functions deploy <name>` → call from FE via `supabase.invokeFunction('<name>', body)`

**Add new table**: Create migration file `supabase/migrations/00005_<desc>.sql` → define table with RLS policies → update FE models and services to query the new table

**Add field to table**: Create migration file → `ALTER TABLE ... ADD COLUMN ...` → update RLS policies if needed → update FE model → update forms/views

**Add new page (FE)**: Create component in `features/` → add route in `app.routes.ts` → add navigation link

**Add new mobile screen**: Create screen in `app/features/{role}/` → add to appropriate navigator → use Supabase client for data access

**Next migration number**: 00005. File goes in `supabase/migrations/00005_<desc>.sql`

---

## Debugging Quick Reference

- **Auth errors**: Check Supabase Auth dashboard, verify session with `supabase.auth.getSession()`, check profile exists in `profiles` table
- **RLS denied (empty results or 403)**: Check RLS policies on the table, verify `auth.uid()` matches expected user, check role in `profiles`
- **Edge Function errors**: Check Supabase Dashboard → Edge Functions → Logs, or run locally with `supabase functions serve`
- **SSR errors**: Use `isPlatformBrowser()` for `window`/`document`/`localStorage`
- **FE network issues**: Browser F12 → Network tab, check Supabase client requests
- **Mobile auth issues**: Check Expo Secure Store token storage, verify Supabase client config in `env.ts`
- **Stripe issues**: Check Edge Function logs, verify webhook signatures, verify secret keys in Supabase secrets
- **Realtime not working**: Check Supabase Realtime is enabled for the table, verify channel subscription in `WebSocketService`
