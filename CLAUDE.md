# CLAUDE.md — Motion Timișoara

> `AGENTS.md` is a byte-identical mirror of this file. Edit `CLAUDE.md`, then run
> `Copy-Item -LiteralPath CLAUDE.md -Destination AGENTS.md` from the repository root
> (or `cp CLAUDE.md AGENTS.md` in Bash). Never edit the mirror independently.
> The `/proiect-nou` documentation contract was adopted on 2026-09-08 for this existing
> project. Automatic mirror tests and `check:rules` are not installed yet; section 11
> records the remaining implementation work. Do not describe those checks as passing.

## 1. Project Overview

| Field | Value |
|---|---|
| Product | Clubs for children's triathlon and other sports: enrollment, courses, camps, attendance, announcements and payments |
| Platform | React web app plus Capacitor iOS/Android; native is the primary launch target |
| Active codebase | `motiontimisoaraApp/`; existing UI Coverage label `motion-react` |
| Repository | `lakiedward/motion-timisoara` — public; default branch `master` |
| Domain | `motiontimisoara.com`; verify production deployment live before reporting availability |
| Supabase | `motion-timisoara`, ref `ehdzafadshbaaghzdzdo` |
| Stack | React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, React Router 7, TanStack Query 5, react-hook-form, Zod, Supabase, Stripe, Leaflet, Capacitor 8 |
| UI language | Romanian |
| Development preview | `motion-react`, `http://127.0.0.1:3017` |

Parents manage children and enrollments; coaches manage their courses and attendance;
clubs manage their coaches, courses and revenue; admins manage the platform. Check the
actual route guards and RLS before assuming any role can perform an action.

**The product is `motiontimisoaraApp/`.** Build and test this application. The root
`supabase/`, `tests/`, `docs/` and CI configuration support it. `TriathlonTeamFE/`
(Angular), `TriathlonTeamMobile/` (Expo) and `TriathlonTeamBE/` (Kotlin/Spring Boot) are
frozen references. Do not boot them, install their dependencies, add features to them
or delete them. In particular, the backend preserves original API contracts and logic.
Legacy entries in `.claude/launch.json` do not authorize running those stacks.

Rebuild planning and parity references live in
`docs/superpowers/plans/2026-06-15-rebuild-plan-index.md` and
`docs/react-rebuild/feature-parity-inventory.md`. Check code and current tracker state
before treating an old phase checklist as current implementation status.

## 2. Team Tracker

- Project slug **`motiontimisoara`**, `project_id` **16** in `tt_projects`, on tracker
  Supabase **`ntjzghsbrzkvpkniotaj`**. This is separate from the product database.
  Open the working session with `/proiect motiontimisoara`.
- **UI Coverage is the site map.** Read `tt_ui_surfaces` and `tt_section_pipeline` for
  current inventory, purpose and next action. Existing source/plan documents provide
  context; they do not override the tracker's accepted scope. A `planned` section is
  not implemented just because it has an inventory row.
- For a planned section, read its `purpose`, the design sources and neighboring code,
  agree the missing structure, then build the page skeleton and section locally.
  Create criteria only after the human has seen the section. Do not overwrite an
  existing purpose or invent accepted criteria from a plan alone.
- **Human gates belong to the human.** Never write `manual_verdict`,
  `verdict_fingerprint`, `spec_approved_at`, `shipped_at` or the delivery profile's
  `launch_stage`. The human sets these through Team Tracker. Do not bypass the database
  trigger with role changes, forged claims or overrides. `planning_enabled` also
  remains a human decision. Leave the result ready and identify the required button.
- No DDL on `tt_` tables without explicit user authorization. A missing tracker
  migration is an app-version problem; do not apply it as part of project setup.
- **Execute locally** in this checkout or an isolated local worktree, in the current
  session. Do not dispatch implementation or testing to cloud agents. Preserve an
  existing dirty worktree; never stash, reset or commit unrelated work to make it clean.
- **Browser verification is required for UI work.** `@Browser`, the IDE browser,
  `@Chrome` or another available browser are options. Start the local app and verify
  the affected scenario. Claude Preview tool names are not required dependencies.
  Record URL, viewport/device, steps, observed result, relevant captures and console
  errors. If no browser can verify a scenario, keep it explicitly unverified.
- Use 375×812 for native-target UI; use 1440×900, 768×1024 and 375×812 for web-target
  surfaces as applicable to their `platforms`. Browser emulation proves responsive
  rendering; device-only capabilities need the relevant native runtime/device proof.
- Bugs and non-UI features are handled end to end. UI features receive the human's
  final acceptance after agent verification. Guided UI work keeps the human's
  “Aprob criteriile” and “Producție” gates. Technical investigation belongs to the agent;
  group genuine design/scope questions for the human.
- **Complete authorized delivery autonomously:** commit only task files, push, open
  or update the PR, then merge when the required checks, reviews and human gates pass.
  Do not request another approval for each git step.
- **Bugbot before code merge.** Follow the Team Tracker plugin reference
  `skills/references/cursor-bugbot-merge-gate.md`: review the final diff, fix confirmed
  findings, rerun affected verification and repeat review until clean. Never merge
  while review is running or after a tooling failure without an explicit human
  decision. The reference exempts changes with no code diff. Historical waivers do
  not authorize a new one. A build does not replace browser proof or human acceptance.
- Default branch is `master`. In Codex use branches such as
  `codex/fix-bug-<id>-<slug>`, `codex/feat-feature-<id>-<slug>` and
  `codex/ui-section-<id>-<slug>`. Include the tracker item when one exists; use a
  descriptive documentation branch for documentation-only work. One branch, one task.
- Mark a bug `Fixed` or a feature/To-Do `Gata` only after required verification and
  actual merge, plus any required deployment. At the natural close of work, propose
  `/pontaj` if the user has not already requested it.

## 3. Commands

Run application commands from `motiontimisoaraApp/`:

| Command | Actual behavior |
|---|---|
| `npm ci` | Install locked app dependencies |
| `npm run dev -- --port 3017 --strictPort --host 127.0.0.1` | Start the working preview; plain `npm run dev` uses Vite's default port |
| `npm run typecheck` | `tsc -p tsconfig.app.json --noEmit`; checks application TypeScript |
| `npm run lint` | ESLint; read warnings even when exit code is zero |
| `npm test` | `vitest run`; currently does **not** run `check:rules` |
| `npm run test:watch` | Vitest watch mode |
| `npm run build` | `tsc -b && vite build`, output `dist/` |
| `npm run preview` | Serve the existing production build |
| `npm run conventions` | Regenerate `docs/ui-conventions.md` from code |
| `npm run format` | Prettier for app source; limit changes to the task |
| `npm run cap:sync` | Build and synchronize native projects |
| `npm run android` | Build, synchronize Android and open Android Studio |
| `npm run check:rules` | Required by the house contract, **not implemented yet**; see section 11 |

Before opening a PR, run `npm run typecheck`, `npm run lint`, `npm test` and
`npm run build`, stopping on a failed command and reporting the real result. Do not
substitute bare `tsc --noEmit`: the root TypeScript config uses project references and
can otherwise produce a misleading successful exit without checking the app.

`.github/workflows/app-ci.yml` runs the app's install, typecheck, lint, test and build
steps. Read its current path filters when deciding whether a change will trigger CI.

### Root Playwright suite

Run `npx playwright test` from the repository root. `playwright.config.ts` defaults to
**`http://127.0.0.1:3021`**, builds `motiontimisoaraApp/` and starts its preview server.
Port 3021 is the suite's isolated preview; 3017 is the interactive development preview.
`BASE_URL` overrides the target. An external target disables the local web server;
when testing an existing development server, start it first and set `BASE_URL` explicitly.

The suite includes `tests/smoke-tests.spec.ts`, `tests/production-readiness.spec.ts`
and `tests/helpers/target.ts`. `.github/workflows/playwright.yml` has path filters and
runs Chromium in CI; local defaults include Chromium, Firefox and WebKit. With CI
placeholder credentials, `E2E_PLACEHOLDER_BACKEND` makes backend-dependent checks
explicitly skip. That is not proof of a live backend or native functionality.

`npm run test:checkout-pricing` uses `playwright.pricing.config.ts` and an isolated
build/preview on **3022**, with dummy Supabase configuration and Stripe disabled.
`tests/checkout-pricing.simulation.ts` intercepts every backend call and provides
explicitly simulated parent/child/payment data. These checks prove the checkout
contract and responsive rendering, not live enrollment, payment or native behavior.
The Playwright workflow also runs the enrollment Deno contract tests and isolated
SQL pricing tests. Locally run `npx --yes deno test --no-lock
supabase/functions/enrollment-contract.test.ts` and
`pwsh -NoProfile -File supabase/tests/run-camp-child-pricing.ps1` from the repo root.
The SQL runner creates and removes its own network-isolated Docker container.

### Environment and Supabase

Create the app's `.env` from `.env.example` only when one is missing; preserve an
existing file. The owner provides credentials through the local environment. For this
existing project, `get_publishable_keys` can retrieve the intended Supabase publishable
key when authorized configuration work needs it. Never put credentials in chat,
tracked files or command output. A new-project scaffold writes only `.env.example`.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Required client API URL |
| `VITE_SUPABASE_ANON_KEY` | Required publishable/anon client key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Optional client payment configuration; absent key yields cash-only fallback |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Function environment, injected by Supabase |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payment function and webhook configuration |
| `STRIPE_CONNECT_WEBHOOK_SECRET`, `FRONTEND_URL` | Connect webhook and correct frontend return URL |

The Supabase client configuration is in `src/lib/supabase.ts`; Stripe's client entry
is `src/lib/stripe.ts`. Components do not read service credentials. Vitest supplies
test Supabase values through `vite.config.ts` and needs no production `.env`.

From the repository root, use `npx supabase link --project-ref ehdzafadshbaaghzdzdo`,
`npx supabase migration list` and `npx supabase functions list` when needed.
`npx supabase start` needs Docker; `npx supabase functions serve` serves local functions.
For a local stack, configure the app with `VITE_SUPABASE_URL=http://127.0.0.1:54321`.
Applying a migration or deploying a function changes remote state and must belong to
the authorized task; committing a file alone does neither.

## 4. Folder Structure

```text
motion-timisoara/
├── motiontimisoaraApp/
│   ├── src/
│   │   ├── routes/             # Router, guards and RootLayout
│   │   ├── layout/             # Public/portal layouts, header, footer and navigation
│   │   ├── features/           # Screens and feature-specific hooks/components
│   │   ├── components/ui/      # Canonical UI primitives
│   │   ├── components/         # Shared product components
│   │   ├── api/                # Typed Supabase operations
│   │   ├── lib/                # Shared logic, clients and generated DB types
│   │   ├── test/               # Vitest setup
│   │   └── index.css           # Current tokens, themes and shared styles
│   ├── docs/ui-conventions.md  # Generated, never hand-edited
│   ├── scripts/               # UI-convention generator
│   ├── android/               # Capacitor Android project
│   └── ios/                   # Capacitor iOS project
├── supabase/                  # Product migrations, functions and historical seed
├── tests/                     # Root Playwright suite
├── docs/                      # Design specs, plans and parity references
├── .github/workflows/         # App CI and Playwright
├── .claude/launch.json        # Use only motion-react for the active app
├── TriathlonTeamFE/           # Frozen Angular reference
├── TriathlonTeamMobile/       # Frozen Expo reference
├── TriathlonTeamBE/           # Frozen API/business-logic reference
├── _archive-docs/             # Historical documents
├── CLAUDE.md                  # Authoritative instructions
└── AGENTS.md                  # Exact copy of CLAUDE.md
```

Paths beginning with `src/` in this document are relative to `motiontimisoaraApp/`.
`@/` aliases that directory. Keep the established feature layout; do not create a
parallel `src/pages/` or `src/app/` tree merely to resemble a fresh template.

`src/routes/router.tsx` registers routes; `guards.tsx` enforces authentication and roles.
Features are grouped into `public`, `auth`, `account`, `coach`, `club`, `admin`, `camps`
and `billing`. `src/features/billing/StripeOnboardingPanel.tsx` is shared by coach and
club. Put reusable product components in `components/`, primitives in `components/ui/`,
data access in `api/`, pure shared logic in `lib/` and feature hooks with their feature.
Group growing folders by responsibility; the house limit is 20 files per folder.

### Architecture and backend rules

- Components consume typed `src/api/*.ts` functions through TanStack Query. Do not
  introduce direct Supabase data access in screen components. `src/lib/query.ts`
  sets `staleTime: 30_000`, `retry: 1` and disables refetch on window focus.
- `src/lib/auth-context.tsx` combines the auth session and `profiles` row into
  `AppUser`; `RequireAuth` and role guards protect routes. PostgreSQL RLS remains the
  authorization boundary. UI hiding is not authorization.
- Web sessions use Supabase's localStorage adapter; native uses Capacitor Preferences
  through `src/lib/supabase.ts`. Do not assume identical OAuth/deep-link behavior.
- Store money as integer minor units (bani). Use `baniToRon` / `ronToBani` at boundaries.
  `src/lib/stripe.ts` lazily loads Stripe and returns `null` when unconfigured.
- `src/lib/database.types.ts` is generated. Regenerate it after schema changes; inspect
  current migrations and live state rather than relying on a handwritten table list.
- Migrations are append-only. `supabase/migrations/README.md` maps filenames to remote
  versions; `00042_transactional_attendance.sql` is the latest tracked numbered migration verified
  on 2026-09-09. Before a new migration run
  `git ls-files supabase/migrations` and choose the highest numeric prefix plus one.
  Never infer remote application status or the next number from this snapshot.
- New tables need RLS, UUID primary keys, `timestamptz` timestamps, appropriate enums
  and explicit foreign-key deletion behavior. User-scoped SQL uses the caller's identity;
  privileged actions belong in an explicitly authorized backend path.
- Edge Functions live in `supabase/functions/<name>/index.ts`; shared CORS, Stripe and
  Supabase helpers live in `_shared/`. Return JSON with meaningful status codes.
  Match deployment/authentication configuration to the function's actual caller.
- Live check on 2026-09-08: **14 Edge Functions are ACTIVE**, including `stripe-connect`,
  `stripe-connect-webhook`, `record-attendance` and `purge-expired-media`. Recheck the
  deployed list before diagnosing a failure; ACTIVE does not establish matching source,
  configured Stripe secrets, browser integration or business-flow correctness.
- Upload paths exist in `src/api/admin.ts`, `attachments.ts` and `camp-photos.ts`.
  Bucket policies and migrations define access; do not infer that buckets are empty
  or all images are placeholders. Verify the relevant current storage path.

## 5. Design System

Read `motiontimisoaraApp/docs/ui-conventions.md` before a UI spec or implementation.
It is generated by `scripts/ui-conventions.mjs`; never edit it by hand.
`src/ui-conventions.test.ts` checks that it matches measured code and that existing
drift cannot increase. A convention requires a measurable canonical source; a new
token location or product choice needs a design decision.

**Current source of design values:** `src/index.css` (`:root`, `.dark`, `@theme inline`
and shared component styles). It contains brand/theme colors, fonts, radii and shared
effects. Use existing semantic tokens and established Tailwind scales. No literal
color or arbitrary size in a new component; propose a missing token before using it.
Do not create a second palette or silently redefine existing semantic roles.

The house template's target is `src/styles/tokens.css` plus `docs/design-system.md`
covering colors, spacing, type, radii, shadows, contrast and allowed variants. These
files are not implemented here yet. Until a dedicated code migration, use the current
source above; this documentation change does not rename tokens or adopt a new palette.

| Existing canonical source | Use |
|---|---|
| `src/components/ui/button.tsx` | `Button`: default, destructive, outline, secondary, ghost, link; sizes default, sm, lg, icon |
| `src/components/ui/input.tsx`, `label.tsx` | Inputs and labels |
| `src/components/ui/card.tsx` | Card primitives |
| `src/components/ui/sheet.tsx`, `dropdown-menu.tsx` | Radix-based overlays and menus |
| `src/components/ui/sonner.tsx` | Shared toast renderer; actions use Sonner |
| `src/components/ui/skeleton.tsx` | Loading skeleton; no local copies of `animate-pulse` |
| `src/components/SectionHeader.tsx` | Existing section heading; not the template's `Section` wrapper |
| `src/index.css` `.btn-cta` variants | Established public-site call-to-action styling |

Search and reuse the catalog before creating UI. Extend a canonical component with a
justified variant; do not fork a second button, input or dialog. The template's full
`Select`, `Section`, `Dialog`, `Toast`, `EmptyState` and `Spinner` catalog has not been
adopted as such; existing Radix/Sonner integration must be preserved during adoption.

Use the existing `background/foreground`, `card`, `primary`, `secondary`, `accent`,
`destructive`, `muted` and `border` roles with their foreground pairs. Body font is
Inter Variable; display font is Manrope Variable. Keep `lucide-react` as the current
icon source, with `currentColor` and established sizes; do not use emoji as UI icons.
Text contrast must pass WCAG AA; the convention suite checks token pairs at 4.5:1.
Preserve both themes and keyboard-visible focus.

Use the house text scale `xs` through `3xl` for new shared variants; carry over an
existing screen's accepted design rather than silently resizing it. Popups should
use the established portal/stacking pattern and `z-50`, avoiding clipping by overflow
containers. Every data list needs distinct loading, error/retry and empty states.

Common failures to check: hardcoded design values, duplicate primitive styling,
unapproved type sizes, emoji icons, clipped overlays, competing primary actions,
missing empty/error feedback and a removed focus indicator.

## 6. Code Rules (STRICT)

These are the adopted working rules. **They are not all enforced by CI yet.** Existing
ESLint, TypeScript and UI-convention tests cover part of the contract; `check:rules`,
`jscpd` and the docs-mirror test remain pending. Never claim a check exists because it
is written here, or treat legacy violations as permission to add more.

### Organization, naming and limits

- Put files in the folders described in section 4; group by feature before a folder
  exceeds **20 files**. Do not accumulate unrelated helpers in a root directory.
- One main responsibility per file. Extract focused components, helpers and types.
- **600 lines per source file is the ceiling**, not the target. Split authored code
  before it reaches that limit. Generated artifacts need generator-aware verification;
  do not hand-edit `database.types.ts` to satisfy a line-count check.
- New screen/product components use PascalCase, hooks `useX`, shared modules consistent
  domain names and public routes Romanian kebab-case. Preserve existing primitive
  filenames and exported contracts when extending them. Do not rename generated DB
  types; new handwritten DB-specific wrappers should make that role explicit (`Db…`).
- Before adding a helper or component, search `components/`, `api/`, `lib/` and the
  relevant feature. Reuse or extract shared logic; do not copy a block into another file.

### Remove unused code

Delete superseded active-product components, imports, variables, props, functions,
exports, types, styles, routes, assets and stale configuration in the change that
replaces them. Confirm unused status by searching imports, route registrations and
string references first. No `.bak`, `-copy`, `-old`, `-v2` duplicates or commented-out
implementations. Frozen reference trees and the historical migration ledger are
intentional retained sources, not cleanup candidates.

### No comments in authored code

Do not add inline/block comments, JSDoc, TODOs or commented-out code to authored
`.ts`, `.tsx`, `.js`, `.mjs`, `.astro` or `.css` files. Express behavior through naming
and structure; record the reason in section 7's sources. Remove comments from changed
authored code as part of the relevant refactor. Compiler reference directives and
shebangs are tooling syntax, as recognized by the template checker.

### Review every change

Check organization and naming, comments, file/folder limits, duplication, unused code,
token usage, canonical primitives, section identity and mirror equality. Keep task
scope focused; record pre-existing adoption gaps instead of disguising them as green
checks. For browser-visible behavior, run the browser gate in section 2.

## 7. Where the "why" lives

1. **Commit messages:** conventional `feat:`, `fix:`, `ui:`, `docs:` or `chore:` subjects;
   the body explains the concrete problem, chosen behavior and meaningful tradeoffs.
2. **Design specs and plans:** use `docs/superpowers/specs/` and
   `docs/superpowers/plans/` for non-trivial work, before implementation. A spec does not
   replace the human seeing and approving UI criteria.
3. **Section 10, Decisions:** append dated decisions that outlive one change, including
   tokens, component variants, dependencies and persistent operating conventions.

Document the final behavior for someone who has not read the chat. Keep passwords,
keys, cookies and other credentials out of all three records.

## 8. Section ↔ code

Copy the **exact stable key from the existing tracker row**. Keep codebase label
`motion-react`; do not rename existing identities to the new-template label `app`.
For new surfaces use the audit contract's `stableSurfaceKey` through
`proiect-nou/scripts/sitemap-to-surfaces.mjs`, with the same codebase label as the
registry. Never reconstruct keys from memory or rewrite existing rows to match a
different example's key shape.

The house target is one component per UI Coverage section, rendered through a shared
`Section` carrying `data-section="<exact stable key>"`. That wrapper and systematic
DOM annotation are pending here; `SectionHeader` alone is not that implementation.
Until adoption, retain verified `code_refs` and existing surface identities. Shared
header, footer and navigation are canonical units on their layout hub, not duplicate
surfaces on every route. A page skeleton labels its remaining `planned` sections.

### Existing tracker conventions

- Page-wide criteria belong to the page's **section** surface, for example the existing
  `motion-react:page:<route>:section:toata-pagina`, not its `kind='page'` aggregate.
  Page aggregates intentionally have zero criteria. Read child sections for coverage.
- Criterion text starts with `DE PASTRAT —`, `DE REPARAT —` or
  `STARE NEVERIFICATĂ ÎN SESIUNE —` and ends with `Verificare: …`. Criterion `kind` is
  `visual`, `functional`, `state` or `a11y`. Keep deliberately unexercised states explicit.
- `audit-contract.mjs fingerprint` hashes bytes. With `core.autocrlf=true`, a freshly
  authored LF file and a checked-out CRLF file can produce different fingerprints for
  the same commit. Compute the recorded inventory fingerprint after checking out the
  merged branch, in the state the next audit will inspect. Human verdict fingerprints
  remain human-gated; never write them to hide a stale verdict.

## 9. Communication

Use Romanian in chat and UI strings, English for new code identifiers and technical
documentation, and conventional commit subjects. Preserve established public/API names.
PR titles should identify the concrete task and tracker item when one exists. Report
what changed, why, verification and any material unfinished work.

Group design/scope questions with a recommended option and its reason; resolve routine
technical choices locally. Ask only for missing authorization or a real product
decision. Honor authorization already given, including the agreed delivery steps.

### Browser and test-account operating notes

The configured audit identities are below. Verify their current state when a scenario
needs them; never guess or reuse credentials from real staff or parents.

| Role | Email | Expected destination |
|---|---|---|
| PARENT | `uiaudit.parent@motiontimisoara.test` | `/account` |
| COACH | `uiaudit.coach@motiontimisoara.test` | `/coach` |
| CLUB | `uiaudit.club@motiontimisoara.test` | `/club` |
| ADMIN | `uiaudit.admin@motiontimisoara.test` | `/admin` |

Recorded fixtures: parent has `Copil Audit`, coach has a `coach_profiles` row and club
owns `Club Audit Motion`. These accounts are for read-mostly UI checks: no destructive
admin actions, payments or messages. Creating real test records requires task consent.

Passwords are not stored in the repo. A shared password was committed on 2026-08-17
and removed on 2026-08-20; treat it as compromised. Ask the owner for current credentials
or use an explicitly authorized password reset in Supabase. Never recover a historical
password from git or paste a password into a tracked file, commit or chat response.

- **Toasts:** `RootLayout.tsx` mounts the shared Toaster once. Sonner renders nothing
  when no toast is active, so an absent `[data-sonner-toaster]` is normal. Observe
  `[data-sonner-toast]` while it lives, for example with a `MutationObserver` recording
  text, then read the log. A one-shot late DOM query does not prove feedback is missing.
- **Coach signup fixtures:** `register-coach` validates invitation codes server-side.
  Rejection paths require authorized rows in `coach_invitation_codes` with a real
  `created_by_admin_id`. Expired `expires_at` and exhausted `current_uses/max_uses`
  reject before user creation. Successful signup writes `used_by_user_id`, an FK to
  `profiles`: for consented cleanup, delete the test code or clear that reference before
  deleting the created auth user. Stripe Express creation is caught; missing Stripe
  configuration can leave `stripe_account_id` null without failing signup.
- **Leaflet CSS:** unlayered `leaflet.css` beats Tailwind's layered utilities. Put
  overrides in the existing unlayered `src/features/public/map-popup.css` or
  `src/components/location-picker.css`. Arbitrary utility variants alone do not win.
- **Leaflet drag tests:** dispatch `mousemove` on `.leaflet-container`, not `document`.
  Leaflet reads the last target's `className`; `document` causes a harness error.
  jsdom cannot lay out a map: mock `react-leaflet` at the module boundary, as in
  `src/features/club/ClubLocationFormPage.test.tsx`, and prove real map behavior in-browser.
- **Forced network errors:** `supabase-js` resolves fetch at call time. Patching
  `window.fetch` after load can reject a chosen auth/PostgREST request. Scope the match
  narrowly, apply it again after a full reload and restore it afterwards. SPA navigation
  keeps the patch; reload or use a fresh tab before a final clean-console check so the
  injected failure is not reported as a new app defect. Keep an API rejection unit test
  as complementary coverage, not a substitute for reaching the browser error state.
- **Form subscriptions:** prefer `useWatch({ control, name })` over `watch()` to avoid
  the React Compiler's `react-hooks/incompatible-library` warning. Read lint output:
  warnings may not change its exit code.
- **Route existence:** anonymous access to a registered protected route redirects to
  `/login`; a role mismatch may redirect to `/`. Compare against a deliberately bogus
  path rendering `404 — Pagina nu a fost găsită`. Route registration can be verified
  without logging in; protected functionality still needs authorized role-specific proof.
- **Function deployment:** an undeployed function can fail CORS preflight in-browser.
  Read the actual deployed list before concluding that a CORS header is broken.
- **Debugging:** for auth inspect the session/profile/role; for empty/403 responses
  inspect RLS and caller identity; for functions/Stripe inspect logs and configuration;
  for native behavior inspect `isNative()` and the platform adapter. For CI inspect the
  actual failing job rather than assuming the former production-domain failure persists.

## 10. Decisions

Append-only: `- YYYY-MM-DD — decision — reason`. Preserve operating knowledge when
reorganizing this document; correct obsolete facts with current evidence.

- 2026-09-08 — Adopt the 11-section `/proiect-nou` documentation contract and an exact
  `AGENTS.md` mirror — all agents should receive the same project rules and learned notes.
- 2026-09-08 — Retain `motiontimisoaraApp/`, `motion-react`, `master`, current token names,
  Radix/Sonner/Lucide and feature folders during documentation adoption — this existing
  product must keep its code contracts, visual precedent and tracker identities.
- 2026-09-08 — Record missing template infrastructure explicitly in section 11 — a
  Markdown update cannot install a rule suite, migrate tokens or annotate rendered UI.

- 2026-09-09 — Feature #319 uses the official Capacitor barcode scanner with the
  bundled ZXing Android decoder and iOS SPM; the owner approved Android 8 minimum.
  Camera access is declared on both platforms. Native camera proof and human
  device approval remain separate from browser rendering.
- 2026-09-09 — Attendance mutations go through `record-attendance` and its
  service-only transaction. Direct authenticated writes to `attendance` are revoked.
  Request receipts and per-child/session accounting prevent duplicate debits and
  protect manual corrections from delayed QR scans. Historical attendance receives
  no invented debit or refund. Run `pwsh -NoProfile -File
  supabase/tests/run-transactional-attendance.ps1` and `npx --yes deno test --no-lock
  supabase/functions/record-attendance-contract.test.ts` for the isolated contracts.

- 2026-09-09 — Feature #320 uses session-scoped Edge reads after empty private
  Realtime invalidations, with no coordinate Broadcast/history. Native capture uses
  pinned Capgo 8.4.5 plus a reproducible expiry/cleanup patch; never remove that patch
  without replacing the lifecycle guarantees. The implementation and outstanding
  migration, UI and device gates are documented in
  `docs/superpowers/specs/2026-09-09-feature-320-live-location-app.md`.

- 2026-09-10 — Feature #320 camp sharing starts only through an explicit coach action
  and appears in parent Announcements. The owner selected eight hours per start,
  clamped to the camp end in Europe/Bucharest. Attendance is confirmed once on arrival;
  departure or cancellation removes access. Camp migrations remain proposals until
  individually approved. The owner waived physical iPhone testing for #320; preserve
  iOS build/simulator checks and do not report physical iPhone behavior as verified.

## 11. Known Issues / WIP

- **Template enforcement pending:** install/adapt `scripts/check-rules.mjs`, duplication
  tooling, `tests/check-rules.test.ts` and a byte-comparison mirror test, then integrate
  them with `npm test`/CI. Account for root documentation versus the app's package root.
  Measure existing violations before claiming compliance; do not hide them behind skips
  or looser ceilings. The installed skill owns its template scripts; fix reusable script
  defects upstream and document any monorepo integration work.
- **Design-system adoption pending:** dedicated `src/styles/tokens.css`, a documented
  scale/catalog in `docs/design-system.md`, missing catalog primitives and a canonical
  touch-target token. Preserve existing tokens/themes and measured conventions until
  the associated implementation and UI verification are complete.
- **Section DOM mapping pending:** shared `Section`, exact `data-section` keys and
  verified coverage mapping for existing sections. Do not report this as implemented
  or alter existing tracker identities merely because the rule is now documented.
- **Existing UI drift:** `docs/ui-conventions.md` and its test ceilings are the current
  measured record. Regenerate through the command, never lower a reported number by
  editing the generated Markdown or raise a ceiling to conceal a regression.
- **Attendance test clock stabilized (To-Do #142, 2026-09-08):**
  `src/features/coach/CoachAttendanceCatalog.test.tsx` freezes only `Date` at
  `2026-08-21T12:00:00Z` and restores the real clock after every test. Async timers
  remain real. Boundary cases freeze `2026-09-08T12:00:00Z` and check one millisecond
  before, exactly at and one millisecond beyond 14 days; the product threshold is
  unchanged. Default worker startup previously timed out locally; use
  `npm test -- --maxWorkers=4` for the bounded local suite.
- **Release state:** a local build, a merged PR and ACTIVE Edge Functions do not establish
  a production release. Verify domain deployment, payment configuration, native flows
  and required human gates live for the delivery being assessed. No unverified old
  deployment or secret-configuration snapshot should be presented as current.
- **Feature #315 live integration (2026-09-08):** after owner approval, migration
  `00041_camp_child_price_server_only.sql` was applied as remote version `20260908143741`.
  `validate-enrollment` and `create-enrollment` are deployed at version 3 with JWT
  verification enabled and source matched to merged PRs #67/#68. Browser verification
  used the local merged frontend and live Supabase: parent login, public age tariffs
  at three viewports, out-of-range rejection and cash enrollment at 600/800 RON.
  Thirteen live API checks covered client RPC denial, ownership, changed quotes,
  single pricing and preserved processed/gateway-associated payment amounts.
  All temporary fixtures and local session/password files were removed; no actual
  charge or refund occurred. Existing camps remain in single-price mode. UI Coverage
  code references were updated after PR #68 without changing human verdicts.
  See `docs/superpowers/specs/2026-09-08-feature-315-live-verification.md` for evidence.
  Human UI acceptance, approved frontend release and relevant native verification
  remain separate completion gates; this does not establish a production release.
- **Public-repository hygiene:** `.env` and `.claude/settings.local.json` remain ignored.
  No credentials, cookie jars or large binaries in tracked files. Historical compromised
  audit credentials and removed original photos remain history-cleanup concerns; a
  destructive history rewrite needs separate explicit authorization. Keep the retired
  source trees and `supabase/seed/migrate-data.ts` as intentional historical references.
