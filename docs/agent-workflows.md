# Agent workflows

Read this document only for the workflow being performed. Shared rules are in [AGENTS.md](../AGENTS.md); dated product decisions are in [project-decisions.md](project-decisions.md). Commands are relative to the repository root unless explicitly stated otherwise.

## Environment and Supabase

The app uses `motiontimisoaraApp/.env`. Preserve an existing file. The required client variables are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `VITE_STRIPE_PUBLISHABLE_KEY` is optional. `VITE_CARTO_BASEMAP_API_KEY` is an optional basemap credential: missing configuration falls back to OpenStreetMap. Never print environment-file contents to inspect configuration; inspect variable names/presence instead.

Edge Functions receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through Supabase. Payment configuration uses `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` and `FRONTEND_URL`. These are server configuration, not client environment values. Deployment/function status does not prove that the secrets are configured or correct.

For authorized product backend work:

| Purpose | Command |
|---|---|
| Link the intended product project | `npx supabase link --project-ref ehdzafadshbaaghzdzdo` |
| Compare local/remote migration state | `npx supabase migration list` |
| Inspect deployed functions | `npx supabase functions list` |
| Start local services, with Docker | `npx supabase start` |
| Serve local Edge Functions | `npx supabase functions serve <name>` |

Read `supabase/migrations/README.md` and current tracked files before adding a migration. Use the next available numeric prefix, preserving the existing filename convention. Do not edit applied migrations. Regenerate app database types through the connected Supabase type-generation tool or the verified Supabase CLI, without inventing an `npm run db:types` script. Keep the generated output complete; do not hand-edit generated declarations to satisfy a line limit.

For a local backend, the client URL is `http://127.0.0.1:54321`. Running services requires Docker and a deliberate local environment; it is not necessary for Vitest. Do not run a database reset or apply/deploy changes simply to validate a documentation edit. Remote product writes require task authorization; tracker DDL has its separate explicit authorization boundary.

## Application, browser and native verification

The interactive development preview is `http://127.0.0.1:3017` (`motion-react`). If occupied, inspect its owner/process before starting another instance; do not terminate an unrelated session. A temporary validation port may be used and must be recorded. Application commands run inside `motiontimisoaraApp/`.

`npm test -- src/api/geocoding.test.ts` runs one actual test file. `npm test` runs the full Vitest suite; `npm test -- --maxWorkers=4` is an available bounded fallback for worker pressure, not a way to skip assertions. `npm run test:watch` is interactive. `npm run format` rewrites all matching app sources; restrict formatting to the task's files instead of creating unrelated changes.

Root Playwright needs root `npm ci` as well as app dependencies. `npm run test:e2e` uses `playwright.config.ts`: it builds the app and serves an isolated preview at `http://127.0.0.1:3021`. `BASE_URL` selects an external/already-running target and disables the managed local server; start that target first. On PowerShell, set it with `$env:BASE_URL = 'http://127.0.0.1:3017'`, run the suite, then remove the temporary override. Browser binaries must be installed; CI installs Chromium. Read the actual config for local browser projects.

`E2E_PLACEHOLDER_BACKEND` explicitly skips checks that require live Supabase when CI uses placeholder configuration. Skips are not live backend evidence. Root `npm run test:checkout-pricing`, `npm run test:live-location` and `npm run test:competition` run their separate Playwright configurations with simulations; read each fixture/config before interpreting its result. Pricing uses port 3022, dummy Supabase values and no live Stripe charges. Intercepted data proves rendering/contracts, not real enrollment, location sharing or payment.

For enrollment/payment/attendance/live-location backend changes, choose the relevant Deno contract tests and isolated SQL runner from `.github/workflows/app-ci.yml`, `.github/workflows/playwright.yml` and `supabase/tests/`. Examples:

- `npx --yes deno test --no-lock supabase/functions/enrollment-contract.test.ts`
- `npx --yes deno test --no-lock supabase/functions/record-attendance-contract.test.ts`
- `pwsh -NoProfile -File supabase/tests/run-camp-child-pricing.ps1`
- `pwsh -NoProfile -File supabase/tests/run-transactional-attendance.ps1`

SQL runners create/remove their own isolated Docker containers; they do not authorize product database writes. Match coverage to the changed contract and preserve real clocks except where a test deliberately freezes Date. Consult the current CI path filters: root documentation changes do not trigger the app/Playwright workflows.

`npm run cap:sync` builds and updates native projects; inspect Git status immediately afterwards, including after interruption. `npm run android` also opens Android Studio. Do not run either just to validate documentation. CI contains Android and unsigned iOS simulator builds; passing them proves compilation/synthetic contracts, not a physical device's camera, keyboard, push, payments or background location. For native verification record runtime/device, tested SHA, app/build configuration and relevant screenshots/video/logs.

## UI inventory and design

Use live project 16 UI Coverage, codebase `motion-react`. A `planned` row does not mean its section is implemented. Read the actual purpose, design source and neighboring code; show the skeleton before criteria creation. Existing specs provide context rather than replacing current accepted scope.

Use the installed plugin's `skills/references/ui-inventory-sync.md` and audit contract for incremental synchronization after merge. Copy existing stable keys exactly; do not reconstruct them or relabel the codebase to `app`. Shared header/footer/navigation live on their layout hub rather than duplicated on every page. Page aggregate rows intentionally have no page-wide criteria: their child section rows hold those criteria.

Criterion text starts with `DE PASTRAT —`, `DE REPARAT —` or `STARE NEVERIFICATĂ ÎN SESIUNE —` and ends with `Verificare: …`. Kinds are `visual`, `functional`, `state` or `a11y`. Keep deliberately unexercised states explicit. Changing code references or recording evidence never authorizes changing the human's verdict or acceptance timestamps.

The audit fingerprint hashes bytes. With `core.autocrlf=true`, authored LF and checked-out CRLF files can differ for the same commit. Compute the recorded inventory fingerprint from the merged checkout in the state the next audit will inspect. Do not write a human verdict fingerprint to conceal staleness.

The generated `motiontimisoaraApp/docs/ui-conventions.md` records measured tokens/primitives/drift. `src/index.css` remains the source; a proposed `src/styles/tokens.css` or `docs/design-system.md` is not adopted merely by documentation. `SectionHeader` is not a shared `Section` wrapper. Reuse canonical Button/Input/Label/Card/Sheet/Dropdown/Sonner/Skeleton components and public CTA classes. Preserve Inter/Manrope, Lucide/currentColor, semantic foreground pairs and WCAG AA contrast. Data lists need distinct loading, error/retry and empty states.

Review new source for comments, file/folder limits, duplication, unused code, tokens, primitives, exact section identity and overlay/focus behavior. The adoption gaps are explicit: `check:rules`, duplication tooling, dedicated token/catalog migration and systematic Section/DOM mapping are not installed by this document. The former byte-identical CLAUDE/AGENTS mirror is retired; any future instruction check must verify the import/shared contract instead.

## Audit accounts and credential reuse

| Role | Email | Expected destination |
|---|---|---|
| PARENT | `uiaudit.parent@motiontimisoara.test` | `/account` |
| COACH | `uiaudit.coach@motiontimisoara.test` | `/coach` |
| CLUB | `uiaudit.club@motiontimisoara.test` | `/club` |
| ADMIN | `uiaudit.admin@motiontimisoara.test` | `/admin` |

Recorded fixtures include `Copil Audit`, a coach profile and `Club Audit Motion`; verify their live state before using them. These accounts are read-mostly. Saved access does not authorize fixture creation/removal, destructive admin operations, payments or messages.

On the owner's Windows computer, read `C:/Users/lakie/.codex/tools/motion-test-access/README.md` before loading credentials. The reusable store is `%LOCALAPPDATA%/AlkiStudio/test-accounts/motiontimisoara.json`, protected by current-user DPAPI and an owner-only ACL. Import `MotionTestAccess.psm1` from the helper directory; `Get-MotionTestAccessStatus` reports role metadata without printing a password.

The helper permits local HTTP previews with `motion-local-ui-login`, and only `https://motiontimisoara-demo.netlify.app` with `motion-demo-ui-login`. Each handshake must name the actual login origin. Do not broaden the allowlist. Use the README's private child-process pattern to load credentials into browser-control memory and fill the visible login form. Never execute the exporter through a tool terminal, forward stdout/stderr to logs/output, or pass secrets in command arguments/environment files. Clear temporary references after filling and verify the live profile role and destination.

Reuse ready saved passwords for already-authorized login without asking the owner again. If unavailable/rejected, the owner can enter the current password using `Set-TestAccounts.ps1` and its masked local prompt. Password resets, account creation and role changes require their own authorization. A shared password was previously committed and removed: treat it as compromised and never recover it from history. Personal `CLAUDE.local.md` is ignored; it is not a password store.

## Browser troubleshooting

- **Toasts:** `RootLayout.tsx` mounts the shared Toaster once. Sonner may render no toaster node when idle. Observe `[data-sonner-toast]` during its lifetime (for example a MutationObserver capturing text); a late one-shot query does not prove feedback is missing.
- **Coach signup fixtures:** `register-coach` checks expiration/use limits server-side. Authorized code rows need a real `created_by_admin_id`. Successful signup writes `used_by_user_id`, an FK to `profiles`; during consented cleanup, remove the test code or clear its reference before removing the created auth user. A missing Stripe configuration may leave the account ID null while signup succeeds.
- **Leaflet CSS:** unlayered Leaflet CSS wins over layered Tailwind utilities. Use the existing unlayered `src/features/public/map-popup.css` or `src/components/location-picker.css` for overrides; check real stacking/overlays in-browser.
- **Map tests:** send drag `mousemove` to `.leaflet-container`, not `document`. jsdom cannot lay out Leaflet; mock react-leaflet at the module boundary and prove real map behavior in-browser.
- **Forced errors:** supabase-js resolves fetch at call time. Scope any injected fetch rejection narrowly, restore it afterwards, and reload/use a fresh tab before recording a clean console. SPA navigation retains patches; full reload removes them. API rejection tests complement, rather than replace, browser error-state proof.
- **Forms:** use `useWatch({ control, name })` rather than `watch()` to avoid the React Compiler incompatible-library warning; check lint output even if successful.
- **Routes:** a protected registered route may redirect to `/login` anonymously or `/` for a role mismatch; compare with a deliberately bogus path showing 404. Route registration alone does not prove protected functionality.
- **Backend failures:** inspect auth session/profile/role, RLS/caller identity for 403/empty data, and actual deployed functions/logs/configuration for CORS/Stripe failures. An undeployed function can fail preflight. Inspect current failing CI jobs instead of assuming an old failure persists.
