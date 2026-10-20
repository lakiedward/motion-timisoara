# Coach course list: search and filters (#502)

Date: 2026-10-20. Owner chose direction B on the decision card "Cum arată lista de cursuri a antrenorului?".

## Decision

- `/coach/courses` keeps the two-column card grid, now on the flat `Card` primitive like the coach dashboard (#497).
- A filter bar above the grid: search by course name or location (diacritics ignored), status pills Active / Inactive / Toate with counts, sport pills with counts on md+ and a native sport `<select>` on phones.
- The bar follows the `/admin/courses` filter bar from #456 (PR #223). Until #223 lands the coach copy lives in `src/features/coach/courses/`; after it merges both should share one component.
- Empty results show `StatusView` with "Șterge filtrele"; card actions are 44px outline buttons.

## Tradeoffs

- Filters are local state, not URL params: a coach has few courses and the page has no deep links into a filtered view.
- Sport on phones is a select so the filters never take half of a 375px screen (owner feedback on #456).
