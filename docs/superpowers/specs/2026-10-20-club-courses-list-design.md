# Club courses list (/club/courses) — section #489

## Decision

The owner chose direction B on 2026-10-20: a compact list grouped Active / Inactive, the same pattern as `/club/locations` (#492), instead of the card grid used by `/coach/courses` (#502).

## Layout

- Header: title plus "Curs nou" (stacks below the title under 640 px).
- Live-location sessions card stays above the list.
- Filter bar: search over course name, location and coach (diacritics-insensitive), a coach select (clubs have several coaches), and the shared `CourseFilterBar` for status (Active / Inactive / Toate) and sport.
- List: `section` per status with `Active · N` / `Inactive · N` labels and one bordered `ul` with dividers. Each row: name, location under the name, price top-right, sport and status badges, then coach and age range; outline "Editează" and "Dezactivează"/"Activează" buttons at 44 px.
- States: list skeleton with row heights matched to real rows (108 px from 768 px, 160 px on phone), `StatusView` error with "Reîncearcă", dashed empty box with "Creează primul curs", filtered-empty `StatusView` with "Șterge filtrele".

## Tradeoffs

- Rows show about 7 courses per screen at 1440 px versus 4 cards, which matters for clubs with many courses.
- The coach name stays in each row (approved criterion) even though a coach filter exists, because the list is not grouped by coach.
- The toggle stays silent on success (approved criterion); errors still toast, with the RLS reason when the coach left the club.
