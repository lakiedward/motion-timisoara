# Motion Timisoara — React + Supabase + Capacitor Rebuild

**Date:** 2026-06-15
**Status:** Design (awaiting approval)
**Author:** Claude + lakiedward
**Companion doc:** [Feature Parity Inventory](../../react-rebuild/feature-parity-inventory.md) — the exhaustive, screen-by-screen catalogue of the existing Angular app. This spec references it as the source of truth for *what* must be rebuilt; this doc defines *how*.

---

## 1. Goal & Context

Replace the outdated **Angular 20 web app** *and* the separate **Expo/React Native mobile app** with a **single React codebase** that:

1. Runs on the **web** (replacing `TriathlonTeamFE`).
2. Wraps into **native iOS + Android** via **Capacitor** (replacing `TriathlonTeamMobile`).
3. Reaches **full feature parity** with the Angular app (all 5 areas, ~95 screens — see inventory).
4. Gets a **fresh, modern visual redesign** (not a 1:1 copy of the Angular Material look).
5. Talks to **Supabase**, and **completes the backend** so the product is genuinely functional end-to-end.

The platform manages triathlon/multi-sport clubs for kids: parents enroll children, pay (Stripe), view calendars/attendance/announcements; coaches manage courses/activities/attendance; clubs manage coaches/courses/revenue (Stripe Connect); admins control everything. UI is **Romanian**. Money is stored in **minor units (bani)** — `÷100` to display, `×100` to send.

### Why a rebuild (not a migration)
The Angular app is mid-migration to Supabase and **not fully functional**: it references ~40 Edge Functions and several legacy Spring Boot `/api` endpoints that **do not exist** in the repo, and **no live Supabase project is configured** (placeholder URLs everywhere). We rebuild the frontend cleanly in React and finish the backend properly at the same time.

---

## 2. Scope

### In scope
- New React app at `TriathlonTeamApp/` — web + Capacitor (Android + iOS).
- Full UI/UX parity with the Angular app (every screen in the inventory) with a modern redesign.
- **Backend completion** on the existing Supabase project: comprehensive RLS, storage policies, a minimal set of Edge Functions / Postgres RPCs, and migration of the remaining legacy `/api` features (ratings, announcements, locations/sports) onto Supabase.
- Stripe payments + Stripe Connect onboarding (coach + club).
- Realtime (payment readiness, admin session purchases).
- Leaflet maps + Nominatim geocoding.
- Native capabilities: push notifications, camera/photo, geolocation, secure storage, deep links.
- Cloud CI for iOS builds (Codemagic) since the dev machine is Windows.

### Out of scope (non-goals)
- Deleting `TriathlonTeamBE` (archived reference) or the Angular/Expo apps. The new app is **additive**; the old apps are retired only after parity is confirmed.
- Changing the domain/data model beyond what's needed to make existing features work (we extend the schema with new migrations `00005+`, never edit applied ones).
- New features beyond parity (the two admin stubs — Reports, Settings — stay stubs to match current behavior; flagged for later).
- Multi-language (the app is Romanian-only; we structure strings for future i18n but don't add locales now).

---

## 3. Architecture & Tech Stack

| Concern | Choice | Notes |
|---|---|---|
| Bundler / dev | **Vite** + React 19 + TypeScript 5.x | Fast, Capacitor-friendly static build |
| Routing | **React Router v7** (data router) | Lazy routes per area; Romanian paths preserved |
| Server state | **TanStack Query v5** | Caching, mutations, optimistic updates over Supabase |
| Client/UI state | **Zustand** (small) + React Context for auth | No Redux |
| Forms + validation | **react-hook-form + zod** | zod schemas double as runtime + TS types |
| Styling | **Tailwind CSS + shadcn/ui** | Fresh design system, owned components |
| Backend SDK | **@supabase/supabase-js** (+ generated types) | Single client, platform-aware storage adapter |
| Payments | **@stripe/stripe-js** + **@stripe/react-stripe-js** | Card Element + Connect redirects |
| Maps | **react-leaflet** + Leaflet | CartoDB Voyager tiles, RO bounds |
| Geocoding | Nominatim (OpenStreetMap) | Forward + reverse, debounced |
| Native shell | **Capacitor 7** | Android + iOS |
| Prerender (SEO) | **vite-react-ssg** (or equivalent) | Static HTML for public routes only |
| Unit/component tests | **Vitest + React Testing Library** | |
| E2E | **Playwright** | Reuse the existing root `tests/` suite, point at the new app |

### Web vs native
A single `Platform` abstraction (`Capacitor.isNativePlatform()`) gates native-only code. Web build = Vite SPA + prerendered public pages. Native build = same SPA bundled by Capacitor; native plugins activate behind the abstraction. **No SSR** (incompatible with Capacitor; SEO handled by prerender).

---

## 4. Repository Layout

```
motion-timisoara/
├── TriathlonTeamApp/                 # NEW — the unified React + Capacitor app
│   ├── index.html
│   ├── capacitor.config.ts
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── codemagic.yaml                # iOS cloud CI
│   ├── android/                      # Capacitor Android project
│   ├── ios/                          # Capacitor iOS project
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                   # providers: Query, Auth, Router, Stripe, Toaster
│       ├── routes/                   # route tree + guards (RequireAuth, RequireRole)
│       ├── lib/
│       │   ├── supabase.ts           # client singleton + platform storage adapter
│       │   ├── database.types.ts     # GENERATED from Supabase schema
│       │   ├── query.ts              # TanStack Query client
│       │   ├── money.ts              # bani <-> RON helpers
│       │   ├── platform.ts           # web/native detection + native plugin wrappers
│       │   └── stripe.ts
│       ├── components/ui/            # shadcn primitives
│       ├── components/               # shared app components (Calendar, LocationPicker, Lightbox, StarRating, VideoEmbed, RatingDialog, ConfirmDialog, SkeletonLoader, Map…)
│       ├── layout/                   # CoreLayout, Header, Footer, FabAccount, AdminLayout, CoachLayout, ClubLayout
│       ├── features/
│       │   ├── public/               # home, about, contact, program, course-details, map, activities, camps, coaches, clubs
│       │   ├── auth/                 # login, register, signup-choice, coach/club signup, forgot/reset, oauth-callback
│       │   ├── account/              # parent dashboard, children, enrollments, calendar, attendance, announcements, checkout
│       │   ├── coach/                # dashboard, courses, activities, attendance-payments, announcements, locations, my-clubs, stripe-onboarding
│       │   ├── club/                 # dashboard, profile, coaches, courses, locations, attendance-payments, announcements, stripe-onboarding
│       │   └── admin/                # coaches, clubs, users, sports, courses, camps, activities, locations, payments, attendance, reports/settings stubs
│       ├── api/                      # typed data layer: one module per domain (courses.ts, enrollments.ts, payments.ts, attendance.ts, clubs.ts, coaches.ts, children.ts, ratings.ts, announcements.ts, locations.ts, sports.ts…)
│       ├── hooks/                    # TanStack Query hooks built on api/ (useCourses, useEnrollments, useRealtimePayments…)
│       └── styles/
├── supabase/                         # EXISTING — extended, not replaced
│   ├── migrations/                   # add 00005+ (RLS expansion, RPCs, storage policies)
│   └── functions/                    # add the minimal new Edge Functions
├── TriathlonTeamFE/                  # retired after parity (kept for reference)
├── TriathlonTeamMobile/              # retired after parity (kept for reference)
└── docs/
    ├── react-rebuild/feature-parity-inventory.md
    └── superpowers/specs/2026-06-15-…-design.md   # this file
```

---

## 5. Data Layer

### Typed Supabase client
- One singleton (`lib/supabase.ts`) with a **platform-aware storage adapter**: `localStorage` on web, **Capacitor Preferences / Secure Storage** on native (so sessions persist securely on device).
- Config from env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`). For native, baked at build time.
- **`database.types.ts` generated** from the live schema (`supabase gen types`) and committed; the `api/` layer is fully typed against it.

### API modules + Query hooks
- `api/<domain>.ts` = thin typed functions wrapping `supabase.from(...)` / `rpc(...)` / `functions.invoke(...)` / `storage`.
- `hooks/use*.ts` = TanStack Query `useQuery`/`useMutation` wrappers with query-key conventions and cache invalidation.
- **No silent mock fallbacks** (the Angular `AccountService`/`ChildrenService` returned mock data on error — we surface errors instead).

### Money
`lib/money.ts`: `baniToRon`, `ronToBani`, `formatRon` (RO locale). All display divides by 100; all writes multiply.

### Realtime
`hooks/useRealtimeChannel`: wraps Supabase channels. Two consumers: checkout payment readiness (`user:{id}:payments` → `enrollment_ready` / `payment_failed`, ≤15s wait) and admin/coach session purchases (live calendar refresh).

---

## 6. Auth, Roles & Routing

- **AuthProvider** subscribes to `supabase.auth.onAuthStateChange`, loads the `profiles` row, exposes `user` (`{id, name, email, role, phone?, avatarUrl?, needsProfileCompletion}`). `needsProfileCompletion = !phone`.
- Sign-in: email/password + **Google OAuth** (`signInWithOAuth` → `/auth/callback`). Deep-link handling on native returns the OAuth/Stripe redirect into the app.
- **Roles:** `ADMIN`, `CLUB`, `COACH`, `PARENT` (from `profiles.role`).
- **Guards:** `RequireAuth` (redirects to `/login?returnUrl=`), `RequireRole` (role check, preserves the Angular role matrix: `/account` → PARENT/COACH/ADMIN; `/coach` → COACH/ADMIN; `/club` → CLUB; `/admin` → ADMIN). Stripe onboarding return routes are **unguarded** (user returns from Stripe).
- **Romanian routes preserved verbatim** (`/cursuri`, `/cursuri/:id`, `/harta`, `/antrenori`, `/cluburi`, `/tabere/:slug`, `/activitati`, `/despre`, `/contact`, `/account/*`, `/coach/*`, `/club/*`, `/admin/*`). Full route table in the inventory §1.
- Login post-redirect: honor `returnUrl`/`redirect`, else role default (ADMIN→`/admin`, CLUB→`/club`, COACH→`/coach`, else `/account`).

---

## 7. Design System (fresh modern redesign)

- **Foundation:** Tailwind tokens (CSS variables) + shadcn/ui components we own and restyle. Dark-mode-ready token structure (light first).
- **Brand:** energetic, sporty, kid-friendly-but-credible. Define a primary (athletic blue/teal) + accent (energetic orange/lime), neutral scale, success/warn/danger, rounded-2xl cards, soft shadows, generous spacing. Replace the Angular Material aesthetic entirely.
- **Typography:** one modern sans (e.g. Inter / Geist) with a slightly expressive display face for hero headings.
- **Reusable components to build** (React equivalents of the shared Angular set): `Calendar` (month grid + week views), `LocationPicker` (search + recent + inline-create + Leaflet modal — the most complex), `Lightbox`, `StarRating` (half-star), `RatingDialog`, `ConfirmDialog` (warning/danger variants), `VideoEmbed` (YouTube/Vimeo/Drive/mp4), `SkeletonLoader`, `Toaster`, `ImageWithFallback`, `ScrollReveal`, `MapView`/`LocationMap`.
- **Motion:** subtle scroll-reveal + count-up on public pages (parity with current), respecting `prefers-reduced-motion`.
- **Mobile-first**, since the same components render in Capacitor; safe-area insets handled for native.
- A short **design-tokens + component-gallery** page is built first so the visual language is locked before feature porting.

---

## 8. Backend Completion (the key extra work)

**Guiding principle — RLS-first, minimal Edge Functions.** The Angular app's ~40 role-prefixed Edge Functions (`coach-…`, `club-…`, `admin-…`) are largely an artifact. In a clean Supabase design, **Row Level Security authorizes role-appropriate CRUD directly**, and **clients upload to Storage directly** under bucket policies. Edge Functions / Postgres RPCs are reserved for operations that genuinely need elevated privileges, atomicity, or external APIs. This cuts the surface from ~40 functions to a small, maintainable set.

### 8.1 New migrations (`00005+`)
- **RLS policies** enabling direct CRUD by role for: `courses`, `course_occurrences`, `activities`, `camps`, `locations`, `sports`, `clubs`, `coach_profiles`, `children`, `club_announcements`, `course_announcements`, `course_announcement_attachments`, `course_ratings`, `coach_ratings`, `coach_invitation_codes`, `club_invitation_codes`, `club_coaches`, `coach_sports`, `club_sports`, `enrollments`, `payments`, `attendance`. Each table: parent owns their children's rows; coach owns their courses/activities/attendance; club owns rows for its coaches/courses; admin full access; public read for active public entities.
- **Storage bucket policies** so clients upload/delete directly (eliminating ~15 base64→EF upload functions): `course-photos`, `coach-photos`, `child-photos`, `club-assets`, `activity-photos`, `announcement-attachments`. Public-read where appropriate; write restricted to the owning role.
- **Postgres RPC functions** for read-heavy aggregations the FE currently expects from EFs: `weekly_calendar(actor, week_start)`, `session_attendance(occurrence_id)`, parent/coach overview rollups. Authorization via RLS + `auth.uid()`/role checks.
- **Invitation codes:** insert via RLS (club/admin) with a DB trigger generating the code; trigger/constraint to track `uses`/`max_uses`/expiry.
- **Triggers** to keep `profiles` synced from `auth.users` (verify existing) and to maintain session counters.

### 8.2 Edge Functions to keep / author
- **Keep (exist):** `register-coach`, `register-club`, `create-enrollment`, `cancel-enrollment`, `create-payment-intent`, `stripe-webhook`, `stripe-connect`, `stripe-connect-webhook`, `mark-cash-paid`, `record-attendance`, `contact-form`.
- **Author (genuinely need service-role / atomicity / Stripe):**
  - `validate-enrollment` — eligibility/age/conflict checks before checkout.
  - `cancel-draft-enrollment` — rollback a draft when card payment fails/aborts.
  - `mark-session-attendance` — atomic attendance write + session decrement.
  - `purchase-sessions` — atomic session top-up (cash), used by parent/coach/club/admin.
  - `create-managed-coach` — create a COACH auth user + profile on behalf of a CLUB owner or ADMIN (needs `auth.admin`). One function, role-authorized — replaces `club-create-coach`/`admin-invite-coach`.
  - (Optional) `export-payments-csv` — or generate CSV client-side from an RLS-gated query.
- **Drop entirely** (replaced by RLS + direct queries/uploads/RPC): every `*-upload-*`/`*-delete-*-photo`, `*-create-course`/`*-update-course`/`*-delete-course`, `*-create-invitation-code`/`*-remove-coach`, `*-weekly-calendar`/`*-session-attendance`, `admin-get-payments`, `join-club`/`leave-club`, etc.

### 8.3 Legacy `/api` features → Supabase
- **Ratings** (course + coach): read aggregate + "my rating" + upsert → `course_ratings` / `coach_ratings` via RLS (parents only write; public reads aggregate).
- **Announcements** (parent feed, coach per-course + global composer): `course_announcements` (+ `course_announcement_attachments`, Storage) and `club_announcements` via RLS. Parent feed = RLS-scoped select across the parent's enrolled courses.
- **Locations & sports dropdowns / CRUD:** direct `locations` / `sports` queries under RLS (replacing `/api/public/locations`, `/api/public/sports`, and the `withCredentials` `LocationService`).

> The exact column/policy details are derived from `00001_schema.sql` during implementation; the inventory §2 lists which tables each screen touches.

---

## 9. Stripe

- **Payments (parent checkout):** `create-payment-intent` EF → `@stripe/react-stripe-js` Card Element → `confirmCardPayment` (20s timeout) → wait on Realtime `enrollment_ready` (≤15s). Cash path skips Stripe.
- **Connect onboarding (coach + club):** `stripe-connect` EF actions (`status`, `onboarding-link`, `refresh-status`, `dashboard-link`). Onboarding redirects to Stripe and returns to the unguarded `…/stripe/onboarding/complete|refresh` routes. On **native**, the return is handled via **deep links** back into the app.
- Publishable key from env; never expose secret keys (they live in Supabase function secrets).

---

## 10. Capacitor / Mobile

- **Platforms:** Android (built locally on Windows) + iOS (configured; built via **Codemagic** cloud CI — no Mac required).
- **Plugins:** `@capacitor/push-notifications` (+ FCM/APNs; register token → store against `profiles` for server-sent pushes, complementing in-app Realtime), `@capacitor/camera` (course/child/activity photos + gallery), `@capacitor/geolocation` (map "near me" + location forms), `@capacitor/preferences` + secure storage (session tokens), `@capacitor/app` + `@capacitor/browser` (deep links for Stripe/OAuth returns), `@capacitor/status-bar`, `@capacitor/splash-screen`.
- **Deep links / URL scheme + universal links** configured so OAuth and Stripe redirects land back in the app.
- **`platform.ts`** wraps every native call with a web fallback (e.g. camera → file input on web; geolocation → browser API).
- `codemagic.yaml` defines the iOS signing + build + TestFlight workflow.

---

## 11. SEO / Prerender

- Public routes (`/`, `/despre`, `/contact`, `/cursuri`, `/cursuri/:id`, `/harta`, `/activitati`, `/tabere`, `/antrenori`, `/cluburi`, …) are **prerendered to static HTML** at build (vite-react-ssg or react-snap), with per-route `<title>`/meta/OG tags.
- Authenticated areas ship as a normal SPA (no SEO needed).
- The Capacitor build uses the SPA entry (prerender artifacts are web-only).

---

## 12. Testing & CI

- **Vitest + RTL** for components, hooks, the money/util layer, and form validation (zod schemas).
- **Playwright** (existing root `tests/`) repointed at the new app's dev/preview server via `BASE_URL`; keep smoke + production-readiness suites, extend for key flows (login, enroll+pay, attendance).
- **CI:** extend `.github/workflows/` — lint + typecheck + unit + build + Playwright for the React app; Codemagic for iOS.

---

## 13. Build Sequence (phased implementation roadmap)

Even as "one tranșă," implementation is ordered so each phase is independently verifiable. Each phase becomes one or more implementation plans.

1. **Foundation** — Vite+React+TS, Tailwind+shadcn, Supabase client (platform storage), TanStack Query, Router shell, env, generated DB types, money/platform libs. Capacitor init (Android + iOS) + a "hello native" build. CI skeleton.
2. **Design system** — tokens, theme, component gallery, core layout (Header/Footer/Fab), shared components.
3. **Auth** — login/register/signup-choice/coach+club signup/forgot+reset/OAuth callback + AuthProvider + guards + deep links.
4. **Public site** — home, about, contact, program+course-details, map, activities, camps, coaches, clubs (+ prerender). Wire ratings/announcements reads.
5. **Parent/Account** — dashboard, children, enrollments, calendar, attendance, announcements, **checkout (Stripe + Realtime)**.
6. **Coach** — dashboard, courses, activities, attendance-payments, announcements, locations, my-clubs, Stripe onboarding.
7. **Club** — dashboard, profile, coaches, courses, locations, attendance-payments, announcements, Stripe onboarding.
8. **Admin** — coaches, clubs, users, sports, courses, camps, activities, locations, payments (CSV), attendance (+Realtime); Reports/Settings stubs.
9. **Backend completion** runs *alongside* phases 4–8 (each feature lands with its RLS/RPC/EF), then a hardening pass: `get_advisors` security/perf review, RLS test matrix, Stripe webhook end-to-end.
10. **Native packaging & store readiness** — push notifications wired, deep links verified, iOS Codemagic build green, Android APK/AAB, app icons/splash.

---

## 14. Risks & Hard Parts

- **Attendance + session-counter engine** — atomic decrement/top-up across parent/coach/club/admin; needs careful RPC/EF + RLS and Realtime refresh. Highest complexity.
- **Checkout** — multi-step wizard + draft enrollment + payment intent + cash + Realtime readiness + rollback. Must be transactional.
- **Stripe Connect onboarding redirects on native** — deep-link round-trip is fiddly; verify early.
- **Backend RLS correctness** — broad policy surface; risk of over- or under-exposure. Mitigate with `get_advisors` and an explicit RLS test matrix (one test per role per table).
- **LocationPicker** — the most complex shared component (search + recent + inline-create + Leaflet).
- **Prerender + Leaflet/Stripe** — browser-only libs must be guarded so prerender/SSG doesn't choke.
- **No live Supabase project configured** — needs creating/linking + applying migrations + seeding before integration testing.

## 15. Open Questions (to resolve during/just before implementation)
- Which Supabase project hosts this app? (none configured yet — create new, or point at an existing one?) Needed before phase 4 integration testing.
- Push-notification provider keys (FCM/APNs) and Apple Developer account for iOS signing — required for phases 9–10.
- Confirm the new directory name `TriathlonTeamApp` (vs e.g. `web`/`app`).

---

## 16. Environment Variables (new app)

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | web + native build | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | web + native build | Supabase anon key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | web + native build | Stripe.js publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase function secrets | Edge Functions only |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` | Supabase function secrets | Edge Functions only |
