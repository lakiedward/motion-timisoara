# Parent dashboard section #520

Date: 2026-09-14. Base: `5f6dc31`.

The owner approved five Team Tracker criteria for section #520, `Salut și statistici`,
at 13:43:54 UTC. The parent greeting follows the coach/club first-name format without
an emoji. The two statistics still precede `Caută cursuri`. Empty child results offer
only the inline first-child action; populated results retain the top add-child button.
The account navigation and statistic-card navigation behavior are unchanged.

Children and enrollments load independently. Pending requests render the shared
skeleton; failed initial requests and failed refreshes show an error with a scoped
retry instead of zero or stale counts. Retrying an initial failure shows pending
again. Retrying a failed refresh disables its retry button until the request settles.
The child list and its empty-state action appear only after a successful child query.
At the 640–767 px breakpoint, error-card content stacks to preserve button spacing.

## Verification

- Local typecheck, lint, all 875 tests in 83 files, and production build passed.
- After the responsive-only adjustment, typecheck, lint, the 19 dashboard/convention
  tests and build passed again. Existing large-chunk and Capacitor import warnings
  remain; lint reported no warnings.
- Seven new tests cover pending and empty responses, active-only enrollment counts,
  independent failures, retry recovery, and failed-refresh behavior with cached data.
- Chrome accessibility/screenshot verification used the actual local app at
  `http://127.0.0.1:3017/account`, authenticated as the owner's parent account, at
  375×812, 768×1024 and 1440×900. The greeting, card order, true zero counts and single
  first-child action were observed. Horizontal navigation scrolling worked at 375 px.
  `Caută cursuri` opened `/cursuri`; browser Back returned to the dashboard.
- A temporary Vite harness at `http://127.0.0.1:3024/__ui520` rendered the actual
  ParentDashboard and AccountLayout with the app's fonts/styles and simulated API
  responses. It exercised pending, error, populated and independently recovered
  queries. Retrying children produced 1 child while enrollments remained in error;
  retrying enrollments then produced 2 active enrollments from 3 fixture rows.
  Error layout was inspected at 375, 640, 768 and 1440 px; loading was inspected at
  phone/tablet widths. Light and dark error rendering passed at 640 px after the
  responsive adjustment. These fixtures never wrote to Supabase.
- No browser console errors were observed in the actual-app or fixture captures.
- Local screenshot evidence is in the session's temporary `motion-520-evidence`
  directory: `live-phone.png`, `live-tablet.png`, `live-desktop.png`,
  `filled-phone.png`, `loading-tablet.png`, `error-640.png`, `error-dark-640.png`
  and `error-desktop.png`.

## Review and delivery boundary

An independent local reviewer inspected the implementation, seven tests and generated
conventions against `5f6dc31` and found no actionable logic defects. The review's
responsive concern at the intermediate breakpoint was checked in Chrome and fixed.
The final responsive change received a follow-up review.

GitHub checks, human visual acceptance, merge and deployment must be established
separately. This report does not claim a production release, a newly installed native
build, physical-device verification, or execution of stored Team Tracker test plans.
The error and populated-data browser scenarios use explicitly simulated responses;
the actual parent account exercised the live successful-empty state.
