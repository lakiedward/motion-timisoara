# Motion Timișoara — agent instructions

This is the shared source of repository instructions. `CLAUDE.md` imports it; do not maintain identical copies. Keep this file under 150 lines and move occasional procedures to the linked documents.

## Scope

- The product is `motiontimisoaraApp/`: React/Vite/TypeScript with Capacitor iOS/Android and Supabase. Native is the primary launch target.
- `TriathlonTeamFE/`, `TriathlonTeamMobile/` and `TriathlonTeamBE/` are frozen references. Do not run, install, change or delete them. Keep historical `supabase/seed/migrate-data.ts`.
- Implement and test locally in this checkout or a local worktree. Do not dispatch project implementation or testing to cloud agents.
- Use Romanian in chat and UI, English for new identifiers and technical documentation. Preserve established public/API names.

## Commands

Run these from `motiontimisoaraApp/`, unless the table says repository root:

| Purpose | Command |
|---|---|
| Install locked dependencies | `npm ci` |
| Interactive preview | `npm run dev -- --port 3017 --strictPort --host 127.0.0.1` |
| Application typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| One test file | `npm test -- src/api/geocoding.test.ts` |
| All unit/component tests | `npm test` |
| Production build | `npm run build` |
| Serve built assets | `npm run preview -- --host 127.0.0.1` |
| Regenerate UI conventions | `npm run conventions` |
| Build and sync native projects | `npm run cap:sync` |
| Build, sync and open Android Studio | `npm run android` |
| Root E2E dependencies | `npm ci` from repository root |
| Root Playwright suite | `npm run test:e2e` from repository root |

Use `npm run typecheck`, not bare `tsc --noEmit`: the root TypeScript configuration uses project references. Read lint warnings even when the exit code is zero. `check:rules` is not an installed script; never report it as passing.

## Environment

- Use PowerShell on Windows; use `pwsh` for the repository's SQL runners. Avoid Bash-only commands in new npm scripts. Prefer Node 22 compatible with the locked dependencies; the repo has no `.nvmrc` pin.
- Preserve existing environment files. Copy `motiontimisoaraApp/.env.example` to `.env` only when missing and needed; obtain values through authorized local configuration.
- The app requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `VITE_STRIPE_PUBLISHABLE_KEY` is optional; an absent key gives cash-only fallback. Vitest supplies test Supabase values itself.
- Product Supabase: `ehdzafadshbaaghzdzdo`. Team Tracker Supabase: `ntjzghsbrzkvpkniotaj`. Keep them separate.
- Supabase local services and isolated SQL runners need Docker. Native iOS builds need macOS/Xcode; Windows/browser checks cannot prove iOS behavior.
- `MOTION_ANDROID_DEMO=1` builds an Android shell loading the public demo URL. It does not prove a bundled local web build.

## Code conventions that must be preserved

- Keep the existing feature layout and `@/` alias to app `src/`; do not create a parallel `src/pages/` or `src/app/` tree.
- Screen data access goes through typed `src/api/*.ts` functions and TanStack Query. Do not add direct Supabase queries to screen components.
- Store money in integer bani; convert through `baniToRon` / `ronToBani`. Keep server-side authorization, price snapshots and payment fulfillment intact.
- Auth must check the session and live profile role. Route guards and hidden controls do not replace PostgreSQL RLS. Web and native session/deep-link adapters differ.
- Authored source files stay at or below 600 lines; group folders before exceeding 20 files. Generated artifacts require generator-aware review, not manual shortening.
- Do not add inline/block comments, JSDoc, TODOs or commented-out code to authored TS/TSX/JS/MJS/Astro/CSS. Remove comments from changed authored code during its relevant refactor; compiler directives and shebangs are allowed.
- Search for existing components/helpers before adding one. Remove superseded active code after checking imports, routes and string references; do not leave backup/old copies.
- Record non-trivial designs/plans in `docs/superpowers/specs/` and `docs/superpowers/plans/` before implementation. Explain tradeoffs in commit bodies; lasting decisions go in `docs/project-decisions.md`.

## UI work

- Read `motiontimisoaraApp/docs/ui-conventions.md` before UI design or implementation. It is generated: use `npm run conventions`, never hand-edit it or raise drift ceilings to conceal a regression.
- `src/index.css` is the current token source. Reuse semantic tokens, established Tailwind scales and `src/components/ui/` primitives; propose missing tokens instead of adding literal colors/arbitrary sizes or a second palette.
- Preserve Radix overlays, Sonner, Lucide icons, both themes and visible keyboard focus. Use the established portal/`z-50` pattern; check clipping, WCAG AA contrast and loading/error-retry/empty states.
- Verify affected UI in a real browser at 375×812 for native-target surfaces and 1440×900, 768×1024, 375×812 for web surfaces as applicable. Record URL, dimensions, steps, result, captures and console errors.
- Browser emulation proves responsive rendering only. Device capabilities require relevant native runtime/device evidence; report any unverified scenario explicitly.

## Team Tracker

- Open `/proiect motiontimisoara`: project ID 16, UI codebase label `motion-react`. Read live `tt_ui_surfaces` and `tt_section_pipeline`; old plans do not override accepted scope.
- Use only the installed `team-tracker@team-tracker` plugin and catalog identifiers `team-tracker:<skill>`. Resolve unprefixed commands and historical local skill links to that plugin, using its catalog path and references/scripts. Never mix old local copies or pin a cache version. If missing, report it.
- Plugin development source is `C:/Users/lakie/Desktop/team-tracker-skills`; execution uses the installed plugin. Local skills without a plugin equivalent remain available.
- For planned sections, read purpose/design sources/neighbors, agree missing structure and show the local skeleton before creating criteria. Do not overwrite purpose or invent accepted criteria from an old plan.
- Human gates remain human-owned: never directly write `manual_verdict`, `verdict_fingerprint`, `spec_approved_at`, `shipped_at`, `launch_stage` or `planning_enabled`, or bypass their triggers.
- No DDL on `tt_` tables without explicit authorization; missing tracker migrations are app-version issues.
- UI features need the human's final acceptance after agent verification. Guided UI keeps “Aprob criteriile” and “Producție”; complete bugs/non-UI features through their applicable gates.
- Preserve exact stable surface keys. Page-wide criteria belong to child section surfaces, not page aggregates. Update inventory after merge using the plugin's contract; never alter a human verdict to hide stale evidence.
- Mark `Fixed` / `Gata` only after required verification, actual merge and any required deployment. Propose `/pontaj` at the natural close unless already requested; honor existing automatic logging without duplicating it.

## Database and access boundaries

- Migrations are append-only. Inspect `git ls-files supabase/migrations` and the migration ledger before choosing the next numeric prefix; never infer remote application from a committed file.
- New tables need RLS/policies, UUID primary keys, `timestamptz` and explicit foreign-key deletion behavior. Use caller identity for user-scoped access; privileged actions require an authorized backend path.
- Regenerate `src/lib/database.types.ts` after schema changes. Product migrations/function deployments may run only within the authorized task; verify remote state and update `supabase/migrations/README.md`.
- Secrets and service-role credentials never belong in client code, tracked files, chat, command output or logs. Do not commit environment files, cookies, keystores, provisioning profiles, local credentials or large binaries.
- Read the audit-access procedure below before loading test credentials. Reuse saved credentials only for authorized destinations/scenarios; verify live profile role. Never recover compromised passwords from Git.
- Audit accounts are read-mostly. Creating/removing test fixtures, resetting passwords, changing roles, real payments or messages need their corresponding explicit task authorization. Existing session authorization remains valid; do not ask again for the same approved action.
- Preserve dirty worktrees. Never stash/reset/clean/rebase or commit unrelated work to make them clean; destructive history rewrites need separate explicit authorization.

## Git, review and definition of done

- Default branch: `master`. Use `codex/fix-bug-<id>-<slug>`, `codex/feat-feature-<id>-<slug>`, `codex/ui-section-<id>-<slug>` or a descriptive `codex/docs-…` branch; one task per branch/PR.
- Use conventional commit subjects and describe concrete behavior/tradeoffs. Commit only task files; do not push directly to `master`.
- Complete authorized delivery: commit, push, open/update the PR and merge when checks, review and human gates pass. Do not require a new approval for each Git step.
- Review the final diff using the installed plugin's `skills/references/code-review-before-merge.md`; available review or current-session review suffices. Fix confirmed findings and rerun affected checks; no named bot is mandatory.
- Before opening an implementation PR, run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` in order; stop on failure, fix and rerun. For documentation-only work, validate commands, references and the final diff proportionately; record actual checks and omissions.
- A completed UI change includes browser evidence and applicable human acceptance. Native, schema, auth and payment changes also need their relevant contracts/integration evidence; fixtures do not prove live or native behavior.
- Merged code, a successful build and ACTIVE functions do not prove publication. Verify the relevant deployment, public assets/SHA and provider/device behavior before claiming release.
- Final reports state what changed, checks/results and material unfinished work. Keep proposed, verified, accepted, merged and published states distinct.

## More context — read when relevant

- [Agent workflows](docs/agent-workflows.md): environment/Supabase commands, E2E/SQL/native checks, UI inventory synchronization, audit login and browser troubleshooting.
- [Project decisions](docs/project-decisions.md): before changing attendance, live location, push, native payments, camp/course pricing, uploads, heroes or keyboard behavior; dated entries are historical evidence, not live status.
- [Migration ledger](supabase/migrations/README.md): before schema changes or diagnosing source/deployment drift.
- [Rebuild index](docs/superpowers/plans/2026-06-15-rebuild-plan-index.md) and [parity inventory](docs/react-rebuild/feature-parity-inventory.md): when comparing active behavior to frozen references; revalidate current code and tracker.
