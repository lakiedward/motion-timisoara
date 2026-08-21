# AGENTS.md

Project overview, architecture, and standard commands live in `CLAUDE.md`. Read it first. This file only adds operating notes that do not belong there.

## Scope

The product is **`motiontimisoaraApp/`** — React + Vite + Capacitor on Supabase. It is the only tree you should be building, testing, or changing.

`TriathlonTeamFE/` (Angular), `TriathlonTeamMobile/` (Expo) and `TriathlonTeamBE/` (Kotlin/Spring Boot) are frozen. They are kept as reference for screens and API contracts not yet rebuilt. **Do not boot them, do not install their dependencies, and do not add features to them.** Earlier revisions of this file described how to run the Spring Boot API and the Angular frontend against a local PostgreSQL; that stack is retired and those instructions have been removed.

## Running the app

```bash
cd motiontimisoaraApp
npm ci
cp .env.example .env    # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

`.claude/launch.json` exposes the same thing as the **`motion-react`** preview on port **3017**, which is the port the root Playwright suite expects. Get the anon key from the Supabase MCP (`get_publishable_keys`) rather than hardcoding it — and never commit it.

Before opening a PR, run what CI runs: `npm run typecheck && npm run lint && npm test && npm run build`.

## Supabase

Project **motion-timisoara**, ref `ehdzafadshbaaghzdzdo`. `supabase/config.toml` is committed; the project ref is not a secret, but keys and the database password must never be.

Deployment state is not visible from the source tree — three tracked Edge Functions are not deployed. Check `CLAUDE.md` or `npx supabase functions list` before assuming a function is live.

## UI-audit test accounts

Four confirmed accounts on the live project, one per role. **Do not guess or reuse passwords for real staff or parent accounts.**

| Role | Email | Lands on |
| --- | --- | --- |
| PARENT | `uiaudit.parent@motiontimisoara.test` | `/account` |
| COACH | `uiaudit.coach@motiontimisoara.test` | `/coach` |
| CLUB | `uiaudit.club@motiontimisoara.test` | `/club` |
| ADMIN | `uiaudit.admin@motiontimisoara.test` | `/admin` |

Parent has a child named `Copil Audit`. Coach has a `coach_profiles` row. Club owns `Club Audit Motion`.

**Passwords are not stored in this repo.** A shared password for these four accounts was committed here on 2026-08-17 and removed on 2026-08-20; because this repository is public, it must be treated as compromised and rotated. Ask the repo owner for the current credentials, or set them yourself in the Supabase dashboard. Do not paste a password back into this file, into a commit message, or into any tracked file.

These accounts are for read-mostly UI verification. Do not use them for destructive admin actions, payments, or sending messages.

### Team Tracker UI-spec conventions (Supabase `ntjzghsbrzkvpkniotaj`, project_id 16)
- Spec criteria for a page live in `tt_ui_surface_criteria` attached to the page's **section** surface (`motion-react:page:<route>:section:toata-pagina`), NOT the `kind='page'` surface — the page surfaces have zero criteria by design, so counting criteria on them always yields 0.
- Criterion text convention: prefix `DE PASTRAT —` (behavior to keep), `DE REPARAT —` (spec decision not yet true in the app), or `STARE NEVERIFICATĂ ÎN SESIUNE —` (state deliberately not forced), each ending with a `Verificare: …` sentence. `kind` is one of `visual`/`functional`/`state`/`a11y`.

### Verifying toast feedback in the browser
- Sonner's `<Toaster>` returns `null` while no toast is active (`sonner/dist/index.mjs`, `if (!filteredToasts.length) return null`), so `[data-sonner-toaster]` is simply absent most of the time. Its absence is **not** evidence that toasts are broken, and a one-shot DOM query after an action usually runs either before the toast mounts or after it auto-dismisses. To prove a toast fired, record it while it lives — e.g. a `MutationObserver` on `document.body` collecting `[data-sonner-toast]` text — then read the log afterwards.
- `<Toaster>` is mounted once in `src/routes/RootLayout.tsx`, which wraps every route, so a missing toast is never a missing provider.

### Exercising coach signup (`/register-coach`) end to end
- The invitation code is checked server-side by the `register-coach` Edge Function, so the error paths need real rows in `coach_invitation_codes`. `created_by_admin_id` is NOT NULL — take an existing `profiles.id` where `role = 'ADMIN'`. `expires_at` in the past → expired; `current_uses >= max_uses` → used up. All three rejections happen before user creation, so a rejected attempt leaves no account behind.
- A code that succeeds writes `used_by_user_id`, and that column has an FK to `profiles`. Deleting the coach you just created fails with `coach_invitation_codes_used_by_user_id_fkey` until the code row is deleted (or the column cleared) first — delete the code, then the `auth.users` row, which cascades to `profiles`/`coach_profiles`.
- Registration also tries to open a Stripe Express account, wrapped in try/catch. With no Stripe key configured it just leaves `coach_profiles.stripe_account_id` null; the signup itself still succeeds.

## Repo hygiene

- This repository is **public**. Nothing secret goes in a tracked file — no keys, no passwords, no cookie jars, no `.env`.
- `.claude/settings.local.json` is machine-local and gitignored. Keep it that way.
- The 226 MB of original photos that used to sit in `TriathlonTeamFE/public/ui-backup/` were removed from HEAD on 2026-08-20, but they still dominate clone size because they remain in git history until a `filter-repo` pass runs. Do not add large binaries to any tree.

### Verifying routes and Edge Functions (learned the hard way)
- **A route's existence can be proven without logging in.** Guards redirect: a route that exists but is gated sends an anonymous visitor to `/login` (or to `/` on a role mismatch), while a path that matches nothing renders the `404 — Pagina nu a fost găsită` page. So to prove "this route is registered, not a 404", hit it logged out alongside a deliberately bogus control path and compare — no session needed.
- **A tracked Edge Function is not necessarily a deployed one.** `supabase/functions/` and the project's deployed list drift apart; several functions live in git but were never pushed. An undeployed function fails CORS preflight, which surfaces in the browser console as `blocked by CORS policy ... does not have HTTP ok status` rather than as a clean 404 — do not read that as a CORS bug. Check `npx supabase functions list` before concluding a function is broken.
