# E2E tests

Playwright, run from the repo root. Both suites target the **React app**
(`motiontimisoaraApp/`) and assert on its Romanian public routes.

## Suites

| File | Covers |
|------|--------|
| `smoke-tests.spec.ts` | Is it up at all: homepage returns 200, assets load, no uncaught page errors, header and footer render, main public routes return 200, `robots.txt` does not 500. |
| `production-readiness.spec.ts` | The real pass: public shell and hero, every header route, navigation between pages, course listing and details, login and register forms with their Romanian validation messages, the 404 page, HTTPS/HSTS and mixed-content checks, Supabase reachability, load-time budget, image decoding, responsive nav at 375/768/1440, and outbound-link safety. |
| `role-smoke.spec.ts` | Signed-in smoke for admin, club, coach and parent at 1440×900 and 375×812: each role's dashboard, every sidebar/tab link to its lists, and the main create forms open without an error state or uncaught page error. Read-only: see below. |
| `helpers/supabase-write-guard.ts` | Aborts every non-GET/HEAD request to Supabase except token refresh and an allowlist of STABLE read RPCs, records what it blocked, and proves itself with a probe POST. |
| `helpers/target.ts` | One shared predicate, `isLocalPreview(baseURL)`. Assertions that only make sense on one target — Romanian React copy locally, HTTPS hardening in production — gate on it instead of keeping copies that drift. |

## Choosing a target

`baseURL` comes from `BASE_URL`, defaulting to `https://www.motiontimisoara.com`.

**That default currently returns a 404** — there is no production deploy — so a
bare `npx playwright test` fails by design. Point it at a running app instead.

Start the app first (`motion-react` in `.claude/launch.json`, or
`npm run dev -- --port 3017` in `motiontimisoaraApp/`), then:

```bash
BASE_URL=http://127.0.0.1:3017 npx playwright test
```

PowerShell:

```powershell
$env:BASE_URL='http://127.0.0.1:3017'; npx playwright test
```

Configuration lives in `playwright.config.ts` at the repo root: 60s per test,
15s per action, 30s per navigation, HTML reporter, trace and video on retry,
and three engines (chromium, firefox, webkit).

## CI

`.github/workflows/playwright.yml` runs `npx playwright test` on every push and
PR to master. It sets no `BASE_URL`, so it hits the 404 domain and **is red on
every run**, and it has no `paths:` filter, so it also fires on
documentation-only commits. The gate that reflects real health is
`.github/workflows/app-ci.yml`.

## Role smoke on master-- (read-only)

`role-smoke.spec.ts` runs only on chromium and only when a saved session for the
target origin exists in `.qa-auth/` (gitignored), so CI and runs without
sessions skip it. Sessions come from `scripts/qa-login.mjs`; never commit them.

```bash
for r in admin club coach parent; do
  node scripts/qa-login.mjs $r --base-url https://master--motiontimisoara.netlify.app --allow-live --out .qa-auth/$r-master.json
done
BASE_URL=https://master--motiontimisoara.netlify.app npm run test:roles
```

The target talks to the production database, so every test installs the
Supabase write guard before the first navigation. The first test of each role
and viewport sends a probe POST and fails unless the guard aborted it. Writes
the app attempted and the guard stopped are listed as `scrieri blocate`
annotations in the report. A new read RPC joins the allowlist only after
`pg_proc.provolatile` confirms it is STABLE.
