# Motion Timișoara - Triathlon Team Platform

## Project Overview
Platform for managing a triathlon & multi-sport club for kids. Parents enroll children in courses, manage payments, view calendars. Coaches manage courses, attendance, photos. Admins have full control.

**Status**: Testing phase | **Domain**: motiontimisoara.com (planned)

## Monorepo Structure
```
TriathlonTeamTimisoara/
├── TriathlonTeamBE/       # Kotlin Spring Boot 3.5 (JDK 21)
├── TriathlonTeamFE/       # Angular 20 + SSR
├── TriathlonTeamMobile/   # Mobile app
└── _archive-docs/         # Historical docs & summaries
```

## Backend (TriathlonTeamBE)

**Stack**: Kotlin 1.9 · Spring Boot 3.5 · PostgreSQL · Flyway · JWT (HMAC512) · Stripe

**Key paths**:
- Entities: `src/main/kotlin/com/club/triathlon/domain/`
- Services: `src/main/kotlin/com/club/triathlon/service/`
- Controllers: `src/main/kotlin/com/club/triathlon/web/`
- Security: `src/main/kotlin/com/club/triathlon/security/`
- Migrations: `src/main/resources/db/migration/` (naming: `V{n}__{desc}.sql`)
- Config: `src/main/resources/application.yml`

**Main entities**: User, Child, Course, CourseOccurrence, Enrollment, Attendance, Payment, MonthlyPayment, CoachProfile, Location, Sport, Camp

**Auth**: Dual JWT strategy — access token (15min, HttpOnly cookie) + refresh token (7 days, DB-backed, one-time use). BCrypt passwords. Roles: PARENT, COACH, ADMIN.

**API structure**:
- `/api/public/*` — no auth (courses, coaches, locations, sports, camps)
- `/api/auth/*` — login, register, refresh, logout
- `/api/account/*`, `/api/enrollments/*` — ROLE_PARENT
- `/api/coach/*` — ROLE_COACH + ROLE_ADMIN
- `/api/admin/*` — ROLE_ADMIN (+ attendance shared with COACH)

**Run locally**:
```bash
cd TriathlonTeamBE
# Set env vars: DATABASE_URL, DATABASE_USERNAME, DATABASE_PASSWORD, JWT_SECRET (min 32 chars), CORS_ALLOWED_ORIGINS
./gradlew bootRun    # starts on port 8081
./gradlew test       # run tests (H2 in-memory)
```

**Deployed**: Railway at `https://triathlonteambe-production.up.railway.app`

## Frontend (TriathlonTeamFE)

**Stack**: Angular 20 · TypeScript 5.9 · Angular Material · Angular SSR · RxJS · Stripe.js

**Key paths**:
- Features: `src/app/features/` (account, admin, auth, camps, coach, coaches, program, static)
- Core: `src/app/core/` (guards, interceptors, services, layout components)
- Shared: `src/app/shared/` (reusable components, directives, pipes)
- Routes: `src/app/app.routes.ts`
- API base URL config: `src/index.html` → `<meta name="api-base-url" content="...">`
- SSR server: `server.ts`

**Interceptors chain**: BaseUrlInterceptor → AuthInterceptor → LoadingInterceptor → ErrorInterceptor

**State management**: RxJS BehaviorSubject (no NgRx)

**Run locally**:
```bash
cd TriathlonTeamFE
npm ci
npm start            # dev server on http://localhost:4200
npm run build        # production build with SSR
npm test             # Karma + Jasmine
```

**API URL**: Change meta tag in `src/index.html`:
- Local BE: `http://localhost:8081`
- Deployed BE: `https://triathlonteambe-production.up.railway.app`

## Development Workflows

**Full local** (FE + BE): Start BE first (`./gradlew bootRun`), then FE (`npm start`). Set meta tag to `localhost:8081`.

**Hybrid** (FE local + BE deployed): Just `npm start` in FE. Meta tag pointed at Railway URL.

## Coding Conventions

**Backend (Kotlin)**:
- Data classes for DTOs
- Services annotated with `@Service`, controllers with `@RestController`
- Repositories extend `JpaRepository`
- New DB fields → Flyway migration (`V{n}__{desc}.sql`), NOT `ddl-auto`
- `hibernate.ddl-auto=validate` in production

**Frontend (Angular)**:
- Feature modules lazy-loaded per route
- Standalone components where possible
- Component naming: `my-thing.component.ts`
- Component-scoped SCSS styles
- Use `isPlatformBrowser()` for browser-only code (SSR safety)
- `OnPush` change detection + `trackBy` for lists
- `withCredentials: true` for all API calls (cookie auth)

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
| `USE_SECURE_COOKIES` | No | `true` in production |
| `APP_TIME_ZONE` | No | Default `Europe/Bucharest` |

## Common Tasks

**Add new endpoint**: Controller method → Service logic → Test with Swagger (`/swagger-ui.html`) → FE service method → consume in component

**Add field to entity**: Update Kotlin entity → Flyway migration → Update DTOs → Update FE model → Update forms/views

**Add new page (FE)**: Create component in `features/` → Add route in `app.routes.ts` → Add navigation link

## Debugging Quick Reference

- **401 Unauthorized**: Token expired/missing → re-login, check cookie sent
- **CORS error**: Update `CORS_ALLOWED_ORIGINS` on backend
- **SSR errors**: Use `isPlatformBrowser()` for `window`/`document`/`localStorage`
- **Backend logs**: Railway Dashboard or local console
- **FE network issues**: Browser F12 → Network tab
