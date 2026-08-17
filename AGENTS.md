# AGENTS.md

Project overview, architecture, and standard commands live in `CLAUDE.md`. This file only adds Cursor Cloud specific, non-obvious operating notes.

## Cursor Cloud specific instructions

### Integration branch
The React marketplace (`motiontimisoaraApp`) lives on `claude/react-rebuild`, not on `master`. `master` is still the older Angular/Kotlin stack. Branch feature work from an updated `claude/react-rebuild` and open PRs against that branch.

### Motion React preview
From `motiontimisoaraApp/`: `npm run dev -- --port 3017 --host 127.0.0.1`. Launch entry in `.claude/launch.json` is `motion-react`. Copy `.env.example` to `.env` and point `VITE_SUPABASE_URL` at `https://ehdzafadshbaaghzdzdo.supabase.co`; take the anon key from MCP `get_publishable_keys` (do not commit it).

### UI Coverage required criteria
A required criterion on `tt_ui_surface_criteria` counts as covered only when a `tt_test_items` row has that `criterion_id` and `result = 'pass'`. An AI plan that omits `criterion_id` will not move the section out of `build`.

### Motion React UI-audit accounts (do not guess other passwords)
Dedicated confirmed test users on Supabase project `motion-timisoara` (`ehdzafadshbaaghzdzdo`). Password for all four: `MotionUiAudit-2026!Aa`

| Role | Email | Lands on |
| --- | --- | --- |
| PARENT | `uiaudit.parent@motiontimisoara.test` | `/account` |
| COACH | `uiaudit.coach@motiontimisoara.test` | `/coach` |
| CLUB | `uiaudit.club@motiontimisoara.test` | `/club` |
| ADMIN | `uiaudit.admin@motiontimisoara.test` | `/admin` |

Parent has a child named `Copil Audit`. Coach has a `coach_profiles` row. Club owns `Club Audit Motion`. Do not use these accounts for destructive admin, payments, or messages. Never guess credentials for real staff/parent accounts.

### Coach registration spec and invite codes
UI spec criteria for `/register-coach` belong on section `motion-react:page:/register-coach:section:toata-pagina`. Tracker rejects `spec_approved_at` and any non-`unreviewed` verdict on page rows. The page only length-checks the invite code (≥5) until final submit; Edge Function `register-coach` is what looks up `coach_invitation_codes` and increments `current_uses`. Spec and smoke walks must not submit a real invitation code.
