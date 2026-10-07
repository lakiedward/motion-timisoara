# Agent instruction rewrite — verification

## Scope and structure

The owner's Downloads/GHID.md, AGENTS.md and CLAUDE.md were read as structural models, not product configuration. The repository's packages, Capacitor/Supabase configuration, CI filters, existing documentation and previous instruction files were inspected. No product source, dependency, native project or backend configuration is changed by this documentation PR.

- AGENTS.md is the shared source: 100 lines, about 11 KiB, below the requested 150-line and 32-KiB limits.
- CLAUDE.md starts with `@AGENTS.md` and contains only Claude Code guidance: 10 lines. The combined always-loaded instruction files have 110 lines.
- Occasional procedures moved to docs/agent-workflows.md. Existing dated decisions moved intact to docs/project-decisions.md with an explicit later entry retiring the former identical-mirror contract.
- CLAUDE.local.md is ignored. Seven Markdown reference links resolve; the import, instruction length and ignore rule were checked. Full Git diffs are available in the documentation PR.

## Commands actually run

Validation used Node v22.19.0 / npm 10.9.3 on Windows PowerShell in an isolated local worktree based on master f229b20287a835126bd325b24454afff83164d56. The active location UI preview/work was preserved separately.

| Command | Observed result |
|---|---|
| `npm ci` in app | Passed; the existing Capgo patch applied. Audit reported 21 dependency advisories; no dependency update or automatic audit fix was performed. |
| `npm ci` at root | Passed; zero root package advisories. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed without lint warnings. |
| `npm test` | 1,616 passed / one convention-pointer test timed out at 5 seconds under unrestricted worker load. |
| `npm test -- --maxWorkers=4` | Passed: all 172 files / 1,617 tests; no assertions skipped or timeouts increased. |
| `npm test -- src/api/geocoding.test.ts` | Passed: 15 tests. |
| `npm run build` | Passed; existing Capacitor mixed-import and large-chunk warnings remain. |
| `npm run conventions` | Passed; generated output has no semantic diff. |
| `npm run dev -- --port 3031 --strictPort --host 127.0.0.1` | Vite started and HTTP 200 returned. Port 3017 was occupied by the active task preview; temporary validation used 3031. This checks the command/server, not a live backend integration. |
| `npm run preview -- --host 127.0.0.1 --port 3032 --strictPort` | Built assets served with HTTP 200 on temporary port 3032. |
| `npm run test:e2e -- --list` | Parsed the real Playwright configuration and listed 150 tests in two files across configured browsers; no E2E test execution is claimed. |
| `git diff --check`, reference/import/length/ignore checks | Passed. |

## Not executed and why

- Full Playwright E2E/simulation suites and Deno/SQL contracts: this PR changes root instructions/reference Markdown and one ignore rule only. Configuration discovery was validated; product/browser/native/backend behavior is unchanged. Current CI path filters do not trigger app/Playwright jobs for these paths.
- `npm run cap:sync` and `npm run android`: they write native projects and the latter opens Android Studio; neither is needed for documentation. iOS requires macOS/Xcode and no native verification is claimed.
- `npm run test:watch` / `npm run format`: interactive watching and rewriting unrelated source are not required; the actual scripts were inspected.
- Supabase link/start/functions-serve/migration operations: these would configure or start backend services outside the documentation task; no backend state is changed by this PR. Their prerequisites and authorized-use boundary are recorded in the workflow document.
- Claude `/context`, `/memory`, `/doctor`: Claude Code is not installed in this Windows session. The literal import and reference targets were verified, but a Claude runtime-loading test is not claimed. No additional Codex model session was launched; the current session reviewed the shared rules directly.
- `check:rules`, `db:types`, a `.nvmrc` pin, example release/code-review skills and hooks: they are not installed here and are not described as available checks.

## Deliberately omitted from always-loaded instructions

The full folder tree, dependency/version lists, file-by-file descriptions, old migration/function counts and release/WIP snapshots were removed because code, the migration ledger, live tracker and linked specs provide the current truth. Generic clean-code advice and fictional court-booking rules from the examples were not imported. Relevant project-specific limits, frozen-code boundaries, tokens, role/RLS rules, human gates, local credentials, authorized delivery and release evidence were preserved. No remaining product-rule clarification was necessary for this rewrite.
