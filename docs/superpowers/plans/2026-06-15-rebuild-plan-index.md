# Motion Timisoara React Rebuild — Plan Index

Spec: [2026-06-15-react-supabase-capacitor-rebuild-design.md](../specs/2026-06-15-react-supabase-capacitor-rebuild-design.md)

The rebuild is delivered in phases. Each phase has its own detailed implementation plan and produces working, testable software on its own. Plans for later phases are authored when their phase begins (so they reflect what earlier phases actually built).

| Phase | Plan | Status |
|------|------|--------|
| 1. Foundation | [2026-06-15-phase-1-foundation.md](2026-06-15-phase-1-foundation.md) | **✅ Done** |
| 2. Design system | _(to author at phase start)_ | Pending |
| 3. Auth | _(to author)_ | Pending |
| 4. Public site (+ live Supabase project) | _(to author)_ | Pending |
| 5. Parent / Account (+ checkout) | _(to author)_ | Pending |
| 6. Coach portal | _(to author)_ | Pending |
| 7. Club portal | _(to author)_ | Pending |
| 8. Admin portal | _(to author)_ | Pending |
| 9. Backend completion hardening | _(runs alongside 4–8; hardening to author)_ | Pending |
| 10. Native packaging & store readiness | _(to author)_ | Pending |

Backend work (RLS, RPCs, Edge Functions, legacy-feature migration) lands incrementally with the feature phases that need it (4–8), then a dedicated hardening pass (9).
