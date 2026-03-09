# Motion Timișoara - Triathlon Team Platform

## Project Overview
Platform for managing triathlon & multi-sport clubs for kids. Parents enroll children in courses, manage payments, view calendars and announcements. Coaches manage courses, attendance, photos, and announcements. Club owners manage their club, coaches, and revenue. Admins have full control.

**Status**: Testing phase | **Domain**: motiontimisoara.com (planned)

## Monorepo Structure
```
motion-timisoara/
├── TriathlonTeamBE/         # Kotlin Spring Boot 3.5.5 (JDK 21)
├── TriathlonTeamFE/         # Angular 20.3 + SSR
├── TriathlonTeamMobile/     # Expo + React Native 0.81 (React 19)
├── tests/                   # Playwright E2E tests (root-level)
├── src/                     # Root-level static assets (minimal)
├── _archive-docs/           # Historical docs & summaries
├── playwright.config.ts     # E2E test config
├── .github/workflows/       # CI/CD (Playwright)
└── CLAUDE.md                # This file
```

## Backend (TriathlonTeamBE)

**Stack**: Kotlin 1.9.25 · Spring Boot 3.5.5 · PostgreSQL · Flyway · JWT (HMAC512, com.auth0:java-jwt 4.4.0) · Stripe 24.0.0 · AWS S3 SDK 2.25.0 · SpringDoc OpenAPI 2.6.0 · WebSocket · Spring Mail

### Key Paths
- **Entry point**: `src/main/kotlin/com/example/demo/TriathlonTeamBeApplication.kt`
- **Domain entities**: `src/main/kotlin/com/club/triathlon/domain/` (28 entities)
- **Services**: `src/main/kotlin/com/club/triathlon/service/` (47 services, organized in sub-packages)
- **Controllers**: `src/main/kotlin/com/club/triathlon/web/` (60+ controllers, organized in sub-packages)
- **Repositories**: `src/main/kotlin/com/club/triathlon/repo/` (31 repos)
- **Security**: `src/main/kotlin/com/club/triathlon/security/` (JWT filter, auth handlers, user details)
- **Config**: `src/main/kotlin/com/club/triathlon/config/` (11 config classes)
- **Enums**: `src/main/kotlin/com/club/triathlon/enums/` (12 enums)
- **Migrations**: `src/main/resources/db/migration/` (V1–V40, naming: `V{n}__{desc}.sql`)
- **App config**: `src/main/resources/application.yml`

### Main Entities
User, Child, Course, CourseOccurrence, Activity, Camp, Club, Enrollment, Attendance, Payment, MonthlyPayment, Invoice, CoachProfile, CoachInvitationCode, ClubInvitationCode, Location, UserRecentLocation, Sport, CoursePhoto, CourseAnnouncement, CourseAnnouncementAttachment, ClubAnnouncement, CourseRating, CoachRating, RefreshToken, PasswordResetToken, AuditLog

### Enums
EnrollmentKind (COURSE/CAMP/ACTIVITY), EnrollmentStatus, PaymentStatus, PaymentMethod, PaymentRecipientType (COACH/CLUB), AttendanceStatus, Role (ADMIN/CLUB/COACH/PARENT), LocationType, AnnouncementAttachmentType, InvoiceStatus, InvoiceType, IssuerType

### Auth & Security
- Dual JWT strategy: access token (15min, HttpOnly cookie) + refresh token (30 days, DB-backed, one-time use)
- BCrypt passwords, OAuth2 (Google) support
- Roles: PARENT, COACH, CLUB, ADMIN
- Rate limiting: auth (5/15min), public (60/min), contact (3/10min), DSAR (5/1hr)
- CSRF protection with cookie-based tokens

### API Structure
| Prefix | Access | Description |
|--------|--------|-------------|
| `/api/public/*` | No auth | Courses, coaches, clubs, locations, sports, camps, activities, schedule, contact |
| `/api/auth/*` | No auth | Login, register, refresh, logout, forgot/reset password |
| `/api/parent/*` | ROLE_PARENT | Account, children, dashboard |
| `/api/enrollments/*` | ROLE_PARENT | Enrollment management, session purchases |
| `/api/payments/*` | Authenticated | Payment processing |
| `/api/coach/*` | ROLE_COACH + ROLE_ADMIN | Course management, attendance, photos, announcements, payments, locations, Stripe |
| `/api/club/*` | ROLE_CLUB | Club dashboard, attendance, photos, payments |
| `/api/admin/*` | ROLE_ADMIN | Full CRUD for all entities, migration tools, invitation codes |
| `/api/ratings` | Authenticated | Course and coach ratings |
| `/api/webhooks/stripe/*` | Stripe signature | Payment webhooks + Connect webhooks |
| `/swagger-ui.html` | No auth | API documentation |

### Service Sub-packages
`announcement/`, `attendance/`, `camp/`, `course/`, `enrollment/`, `mail/`, `notification/`, `parent/`, `payment/`, `public/`, `rating/`, `storage/`

### Key Integrations
- **Stripe**: Payments + Connect (coach/club revenue sharing)
- **SmartBill**: Romanian invoice generation (optional, disabled by default)
- **S3/Railway Object Storage**: Photo/file storage with presigned URLs
- **WebSocket**: Real-time notifications via STOMP/SockJS
- **Mail**: SMTP via Gmail (optional)

### Run Locally
```bash
cd TriathlonTeamBE
# Required env vars: DATABASE_URL, DATABASE_USERNAME, DATABASE_PASSWORD, JWT_SECRET (min 32 chars), CORS_ALLOWED_ORIGINS
./gradlew bootRun    # starts on port 8081
./gradlew test       # tests with H2 in-memory (Flyway disabled in test profile)
```

### Tests
- Framework: JUnit 5 + Mockito-Kotlin 5.2.0 + Spring Test
- Test DB: H2 in-memory (PostgreSQL mode), `hibernate.ddl-auto=create-drop`
- Test config: `src/test/resources/application-test.yml`
- 7 test classes: application integration, audit, payment, enrollment, recurrence rule, IP detection, DTO validation

**Deployed**: Railway at `https://triathlonteambe-production.up.railway.app`

---

## Frontend (TriathlonTeamFE)

**Stack**: Angular 20.3 · TypeScript 5.9 · Angular Material 20.2 · Angular SSR · RxJS 7.8 · Stripe.js 7.9 · Leaflet 1.9 · STOMP/SockJS (WebSocket)

### Key Paths
- **Features**: `src/app/features/` (13 feature areas)
- **Core**: `src/app/core/` (guards, interceptors, services, layout components, models, tokens, errors)
- **Shared**: `src/app/shared/` (components, directives, pipes, services, utils, styles)
- **Routes**: `src/app/app.routes.ts`
- **API base URL**: `src/index.html` → `<meta name="api-base-url" content="...">`
- **SSR server**: `server.ts`

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
`auth.service.ts`, `public-api.service.ts`, `announcements.service.ts`, `csrf.service.ts`, `error-reporting.service.ts`, `geocoding.service.ts`, `location.service.ts`, `notification.service.ts`, `rating.service.ts`, `websocket.service.ts`

### Interceptors Chain
`BaseUrlInterceptor` → `AuthInterceptor` → `CsrfInterceptor` → `LoadingInterceptor` → `HttpErrorInterceptor`

### Guards
- `auth.guard.ts` — Requires authentication
- `role.guard.ts` — Role-based route protection

### Shared Components
`form-error`, `lightbox`, `loader-overlay`, `location-picker`, `premium-confirm-dialog`, `rating-dialog`, `skeleton-loader`, `star-rating`, `video-embed`, `toast-container`

### Core Layout Components
`core-layout`, `header`, `footer`, `fab-account`

### State Management
RxJS BehaviorSubject (no NgRx). Auth state in `AuthService`, feature-specific state in feature services.

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

### API URL
Change meta tag in `src/index.html`:
- Local BE: `http://localhost:8081`
- Deployed BE: `https://triathlonteambe-production.up.railway.app`

### Code Style
Prettier configured: 100 char width, single quotes, Angular HTML parser.

---

## Mobile App (TriathlonTeamMobile)

**Stack**: Expo · React Native 0.81.5 · React 19 · TypeScript 5.9 · Stripe React Native 0.50.3 · Axios · React Navigation · Expo Secure Store

### Key Paths
- **Entry**: `App.tsx` (AuthProvider → NavigationContainer → RootNavigator)
- **API layer**: `app/api/` (14 API clients, Axios-based)
- **Features**: `app/features/` (auth, admin, coach, parent — organized by role)
- **Navigation**: `app/navigation/` (10 navigators, role-based tab structure)
- **Components**: `app/components/coach/` (shared coach UI components)
- **Config**: `app/config/` (env.ts, theme.ts)
- **State**: `app/store/AuthContext.tsx` (Context API for auth)

### Navigation Hierarchy
```
RootNavigator
├── AuthNavigator (login)
└── MainNavigator (role-based)
    ├── AdminTabsNavigator (dashboard)
    ├── CoachTabsNavigator (attendance, courses, sessions, announcements, payments)
    └── ParentTabsNavigator (home, schedule, children, enrollments, payments, announcements, profile)
```

### API Clients
`authApi`, `enrollmentApi`, `parentChildrenApi`, `parentScheduleApi`, `parentPaymentsApi`, `parentAnnouncementsApi`, `coachCoursesApi`, `coachAttendanceApi`, `coachSessionAttendanceApi`, `coachWeeklyAttendanceApi`, `coachPaymentsApi`, `coachAnnouncementsApi`, `adminCoursesApi`

---

## E2E Tests (Root Level)

**Stack**: Playwright · Chromium/Firefox/WebKit

### Test Suites (`tests/`)
- `smoke-tests.spec.ts` — Quick validation (homepage, API, assets, JS errors, SSL, performance)
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

**Full local** (FE + BE): Start BE first (`./gradlew bootRun`), then FE (`npm start`). Set meta tag to `http://localhost:8081`.

**Hybrid** (FE local + BE deployed): Just `npm start` in FE. Meta tag pointed at Railway URL.

**Mobile**: Run `npx expo start` in TriathlonTeamMobile. Configure `app/config/env.ts` for API URL.

---

## Coding Conventions

### Backend (Kotlin)
- Data classes for DTOs, entities are JPA `@Entity` classes
- Services: `@Service`, Controllers: `@RestController`, Repos: extend `JpaRepository`
- New DB fields → add Flyway migration (`V{n}__{desc}.sql`), NEVER use `ddl-auto`
- `hibernate.ddl-auto=validate` in production
- Service sub-packages by domain: `attendance/`, `payment/`, `enrollment/`, etc.
- Controller sub-packages mirror service structure: `web/admin/`, `web/coach/`, `web/public/`, etc.
- Two package roots: `com.example.demo` (entry point + CORS) and `com.club.triathlon` (all business logic)
- `@Entity`, `@MappedSuperclass`, `@Embeddable` made open via allopen plugin

### Frontend (Angular)
- Feature modules lazy-loaded per route
- Standalone components preferred
- Component naming: `my-thing.component.ts`
- Component-scoped SCSS styles
- Use `isPlatformBrowser()` for browser-only code (SSR safety)
- `OnPush` change detection + `trackBy` for lists
- `withCredentials: true` for all API calls (cookie auth)
- Prettier: 100 char width, single quotes

### Mobile (React Native)
- Feature-first organization by user role
- Custom hooks (`useXyz`) for screen logic
- Centralized API clients in `app/api/`
- Theme constants in `app/config/theme.ts`
- Context API for global state (no Redux)

---

## Environment Variables (Backend)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | `jdbc:postgresql://host:port/db` |
| `DATABASE_USERNAME` | Yes | DB user |
| `DATABASE_PASSWORD` | Yes | DB password |
| `JWT_SECRET` | Yes | Min 32 chars for HMAC512 |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated origins |
| `PORT` | No | Default 8081 |
| `STRIPE_SECRET_KEY` | No | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhooks |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | No | Stripe Connect webhooks |
| `USE_SECURE_COOKIES` | No | `true` in production |
| `APP_TIME_ZONE` | No | Default `Europe/Bucharest` |
| `STORAGE_BUCKET_NAME` | No | S3 bucket for Railway Object Storage |
| `STORAGE_ACCESS_KEY` | No | S3 access key |
| `STORAGE_SECRET_KEY` | No | S3 secret key |
| `SMARTBILL_*` | No | SmartBill invoice integration (disabled by default) |
| `SPRING_MAIL_*` | No | SMTP config for email notifications |
| `GOOGLE_CLIENT_ID` | No | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth2 client secret |

---

## Common Tasks

**Add new endpoint**: Controller method → Service logic → Test with Swagger (`/swagger-ui.html`) → FE service method → consume in component

**Add field to entity**: Update Kotlin entity → Flyway migration (`V{next}__{desc}.sql`) → Update DTOs → Update FE model → Update forms/views

**Add new page (FE)**: Create component in `features/` → Add route in `app.routes.ts` → Add navigation link

**Add new mobile screen**: Create screen in `app/features/{role}/` → Add to appropriate navigator → Create API client if needed

**Add new Flyway migration**: Next number is V41. File goes in `src/main/resources/db/migration/V41__{desc}.sql`

---

## Debugging Quick Reference

- **401 Unauthorized**: Token expired/missing → re-login, check cookie sent with `withCredentials: true`
- **403 Forbidden**: Wrong role or CSRF token missing
- **CORS error**: Update `CORS_ALLOWED_ORIGINS` on backend
- **SSR errors**: Use `isPlatformBrowser()` for `window`/`document`/`localStorage`
- **Backend logs**: Railway Dashboard or local console (`logs/triathlon-app.log`)
- **FE network issues**: Browser F12 → Network tab
- **Mobile auth issues**: Check Expo Secure Store token storage
- **Stripe issues**: Check webhook signatures, verify secret keys match environment
