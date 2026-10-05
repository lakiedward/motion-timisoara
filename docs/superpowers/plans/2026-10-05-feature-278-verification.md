# Feature #278 verification

Verified locally on 2026-10-05 at `http://127.0.0.1:3019`, using the existing
CLUB audit account and the live Motion Supabase project.

## Automated checks and review

Typecheck, lint, the full Vitest suite (164 files, 1514 tests), and build passed
before the follow-up review fix. After two cache race fixes, all 27 focused
form/proximity tests passed and typecheck, lint, and build passed again.
The existing bundle-size and Capacitor import warnings remain.

A later final review of PR #124 at 88b5aa9 identified a P2 choice-lifecycle
regression: choosing at A, moving to B, then returning to A restored the old
choice. The picker callback now clears the choice when its coordinates differ
from the current form values. Delayed reverse lookup at unchanged coordinates
preserves the choice; retired picker callbacks remain guarded.

After this correction, the focused form/proximity suite passed all 29 tests.
This includes A-to-B-to-A regressions for source and new-place choices, plus a
same-coordinate delayed reverse lookup regression. Targeted ESLint, Prettier
checking and application typecheck passed; full application lint and build also
passed again. The replaced single-move test's assertions remain covered by both
round-trip cases. Follow-up independent review found no remaining findings.
Chrome verification moved an explicitly chosen pin away and back to the initial
vicinity: both choices were unpressed and saving required a fresh decision.
Exact coordinate equality in A-to-B-to-A is covered by the regression tests;
map clicks are subject to pixel rounding. No real record was submitted.

## Browser evidence

- At 1440 x 900, 768 x 1024 and 375 x 812, a live nearby source was displayed
  without horizontal overflow. Saving was disabled until an explicit choice.
- Selecting Bazin Olimpic Timisoara copied its name, type, address, city,
  description and exact coordinates (45.7489, 21.2087). The form retained the
  current club as owner.
- The alternative create-new choice enabled saving and displayed its decision.
- Intercepted GET responses verified loading, error with retry, and empty states.
  Restoring the live API and using retry recovered the actual nearby result.
- An intercepted POST verified the exact coordinates and current-club ownership
  in the save payload and successful UI feedback. No real location was inserted;
  the product database retained eight location rows.
- Editing an existing club location retained its current flow without the
  proximity panel. No real edit was submitted.
- Test fetch overrides were removed and the page reloaded. No app console errors
  were recorded; the existing Stripe HTTP warning appeared.

The browser evidence above was collected before the follow-up round-trip fix.
The existing map tile provider returned an API-key-required image. Location
selection, the real reverse lookup and proximity behavior were exercised, but
map imagery availability remains a separate limitation. Browser rendering does
not establish native device behavior.

Screenshots and the sanitized simulated save payload are kept in the session's
local `nearby-278` artifact folder. Human visual acceptance and any publication
remain pending. UI inventory synchronization is deferred until integration of
the final source, preserving existing surface keys and human gates.
