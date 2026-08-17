# AGENTS.md

Project overview, architecture, and standard commands live in `CLAUDE.md` (backend, frontend, mobile, env vars, common tasks). Read it first. This file only adds Cursor Cloud specific, non-obvious operating notes.

## Cursor Cloud specific instructions

### Services & scope
- Web product = **TriathlonTeamBE** (Kotlin/Spring Boot API, port `8081`) + **TriathlonTeamFE** (Angular 20 + SSR, dev port `4200`), backed by **PostgreSQL**. These are the required services for end-to-end web dev.
- **TriathlonTeamMobile** (Expo/React Native) is optional and not needed for web work. Its deps are not installed by the update script — run `npm install` in that folder if you need it.
- Standard commands (bootRun, `npm start`, `npm test`, `./gradlew test`, etc.) are documented in `CLAUDE.md`; only the deviations below are needed to actually boot on a fresh VM.

### System dependencies (already provisioned in the VM snapshot; NOT in the update script)
- JDK 21, Node, and **PostgreSQL 16** are installed. The update script only refreshes JS deps.
- PostgreSQL is **not** auto-started (no systemd). Start it each session and ensure the DB exists:
  - `sudo pg_ctlcluster 16 main start`
  - DB `triathlon`, user/password `postgres`/`postgres` (matches `application.yml` defaults). Recreate if missing: `sudo -u postgres psql -c "CREATE DATABASE triathlon;"` and `sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"`
- `gradlew` may not have its exec bit set on a fresh checkout — invoke the wrapper as `sh ./gradlew ...`.

### Running the backend (non-obvious env vars required to boot on a fresh Postgres)
`application.yml` defaults do **not** boot against a fresh DB. From `TriathlonTeamBE/`, export these before `sh ./gradlew bootRun`:

- `JWT_SECRET=<any string >= 32 chars>` — mandatory, no default.
- `SPRING_FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` — **required for the first migration run on a fresh DB.** Migration `V39__optimize_audit_logs.sql` uses `CREATE INDEX CONCURRENTLY`; with Flyway's default transactional lock, CIC deadlocks against Flyway's own idle-in-transaction connection and `bootRun` hangs forever at "Migrating ... version 39 ... [non-transactional]". This flag switches Flyway to a session-level advisory lock and lets migrations complete.
- `HIBERNATE_DDL_AUTO=update` — the committed schema is Flyway-owned and uses Postgres `DOMAIN` types (e.g. `attendance_status`) plus at least one entity column with no migration (`users.enabled`). `validate` (the default) fails on the DOMAIN types; `none` then fails at query time on the missing `users.enabled` column. `update` lets Hibernate add missing columns on top of the Flyway schema without altering the existing domain-typed columns. Do NOT "fix" this by editing migrations/entities.
- `GOOGLE_CLIENT_ID=dummy-local` and `GOOGLE_CLIENT_SECRET=dummy-local` — the OAuth2 `google` registration is always declared, so Spring refuses to start with an empty client id. Dummy values satisfy startup; real Google login just won't work (optional feature).
- `USE_SECURE_COOKIES=false` — so auth cookies work over plain http in local dev.
- Optional integrations (Stripe, S3/bucket storage, SMTP mail, SmartBill) stay disabled with defaults; core enroll/course/child/attendance flows work without them.

### Calling authenticated write endpoints
Auth is JWT in **HttpOnly cookies** and CSRF is enforced (`CookieCsrfTokenRepository`). For any non-GET API call: first `GET /api/auth/csrf` (with your cookie jar) to receive the `XSRF-TOKEN` cookie, then send it back in the `X-XSRF-TOKEN` header. `GET`s and the public `/api/auth/*` flows are exempt. Public read endpoints live under `/api/public/*` (note: `/api/public/courses` has no list route — only `/{id}`).

### Running the frontend against the LOCAL backend (CSP gotcha)
`index.html` ships a strict CSP whose `connect-src` allows only the production API (`https://api.motiontimisoara.com`), not `http://localhost:8081`. So the CLAUDE.md "point the meta tag at localhost:8081" path is blocked by CSP. To run the full local stack in a browser, keep all API traffic same-origin via an Angular dev proxy:
- Create `TriathlonTeamFE/proxy.conf.json` (gitignore it or leave untracked): `{ "/api": { "target": "http://localhost:8081", "secure": false, "changeOrigin": true } }`
- Temporarily blank the API base so it resolves to same-origin (`''`): the `<meta name="api-base-url">` content in `src/index.html` and `window.NG_APP_API_BASE_URL` in `public/env.js`. Revert these before committing.
- Run `npx ng serve --host 127.0.0.1 --port 4200 --proxy-config proxy.conf.json`.
- `npm start` runs `dotenv -e .env.local -- ng serve`, so it needs a `.env.local` file (gitignored). Create an empty one, or run `ng serve` directly as above.

### Repo quirks
- `TriathlonTeamFE/.angular/cache/**` (Vite dep-optimizer cache) is **tracked in git**. Running `ng serve`/`ng build` rewrites it and pollutes `git status`. Do not commit that churn — `git checkout -- TriathlonTeamFE/.angular && git clean -fdq TriathlonTeamFE/.angular` before committing.
- Backend unit tests: `sh ./gradlew test` (H2 in-memory). Three `AuditServiceTest` cases fail on a clean checkout due to pre-existing test-code bugs (Kotlin non-null `ArgumentCaptor.value` NPE and Mockito matcher misuse), unrelated to environment; the other 29 pass.
