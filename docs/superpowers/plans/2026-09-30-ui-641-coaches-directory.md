# Implementation plan — coaches directory #641 and title #482

1. Read project rules, generated UI conventions and existing controls, directory,
   API and neighboring list tests. Keep unrelated code and backend state intact.
2. Update CoachesPage with the approved subtitle, labeled local name/sport filters,
   distinct loading/error/backend-empty/filtered-empty branches and reset/retry.
   Preserve card content and links; add theme-aware focus and long-content wrapping.
3. Add focused component tests under the public `coaches` responsibility folder,
   avoiding another file in the already oversized public root. Prove filtering
   intersection, label/default/reset behavior, card contracts, loading and recovery.
4. Run the focused tests and inspect the final diff. Hand off the local changes
   for full required checks, browser verification, independent review and delivery.

No new database reads, migrations, private fields, dependencies or primitives are
required. Existing public-folder organization debt stays explicit rather than
being enlarged with unrelated files.
