# Admin course list grouped by organizer (#456)

Owner decision 2026-10-20: direction A ("pe organizatori") plus a "De verificat" filter, so the list stays usable with hundreds of courses.

## Behaviour

- Status pills: Active (default), De verificat, Inactive, Toate, each with its count. Sport pills (with "Toate sporturile") narrow the current status.
- Courses are grouped by organizer: "Cluburi · N", then "Antrenori independenți · N". Each organizer is a collapsible flat card (border, `rounded-xl`, no shadow) whose header shows "X active din Y", children enrolled in active courses and "N de verificat".
- The first card of each section is open by default. An open card shows up to 4 courses and "Vezi toate cele N cursuri".
- Search covers course, coach and club names, diacritics-insensitive. While searching, every card with a match opens, all matches are listed and the matched text is marked. Matches hidden by the current filters are announced as "Încă N rezultate în alte filtre", which switches to Toate.
- "De verificat" means: inactive course with active enrollments, pending enrollments, or an active course whose active enrollments reach its capacity. The reason is shown under the course name.
- Each course shows "Înscriși" as active enrollments over capacity, with a small bar.
- Table from 768px up, stacked rows below; controls keep the 44px touch target below 1024px.

## Data

`getAllCourses` adds `enrollments: { active, pending }` per course from `enrollments` (`kind = 'COURSE'`, `ACTIVE`/`PENDING`), read in pages of 1000 rows. Admins read all enrollments through the existing `enrollments_admin_all` policy; no schema change.

## Extension points

`AdminCoursesPage` accepts `headerActions` and `renderRowActions(course, layout)`, so the course create/edit work (#271) adds "Curs nou" and "Editează" without changing the list.

## Not included

Saved views or URL state for filters, pagination, and sorting other than by active courses per organizer.
