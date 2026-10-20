# Coach course list: search and filters (#502)

Date: 2026-10-20. Owner chose direction B on the decision card "Cum arată lista de cursuri a antrenorului?".

## Decision

- `/coach/courses` keeps the two-column card grid, now on the flat `Card` primitive like the coach dashboard (#497).
- A filter bar above the grid: search by course name or location (diacritics ignored), status pills Active / Inactive / Toate with counts, sport pills with counts on md+ and a native sport `<select>` on phones.
- The status/sport pills reuse `CourseFilterBar` from `/admin/courses` (#456), now generic over its status options; the coach page passes Active / Inactive / Toate and adds its own search input.
- Empty results show `StatusView` with "Șterge filtrele"; card actions are 44px outline buttons.

## Tradeoffs

- Filters are local state, not URL params: a coach has few courses and the page has no deep links into a filtered view.
- Sport on phones is a select so the filters never take half of a 375px screen (owner feedback on #456).
