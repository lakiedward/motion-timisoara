# Panel list rows and dates (Team Tracker bug #1322)

Source: organizer-panel consistency audit, 2026-11-02 (`/mnt/project-files/verificari/consistenta/organizare/raport.md`, section 4).

## Problem

- Activities: admin used compact rows, the coach used two-column cards with a solid blue sport badge and „Activ” (wrong gender for „activitate”), the club used a third card variant.
- Courses: admin used a table from 1280px and cards below it; coach and club used two other card/row variants.
- „Dezactivează” was an outline button in some lists and a ghost button with an icon in others.
- Panel dates appeared in five formats.

## Decision

- One row per offer type, shared by admin, coach and club:
  `src/components/panel-list/ActivityListRow.tsx` and `CourseListRow.tsx`, inside a bordered `divide-y` list (the pattern camps and locations already use).
- Row anatomy: title, gray sport badge (`secondary`), status badge (activity: Activă / Inactivă / Încheiată; course: Activ / Inactiv), one muted meta line (date or location, age, enrolled, price), optional coach line for club-owned offers.
- Actions: `PanelEditAction` (outline, pencil) and `PanelToggleAction` (ghost, power icon) in `PanelRowActions.tsx`; also applied to the admin users list.
- Dates in panels use the public short numeric format `21.11.2026` through `src/lib/panel-date.ts` (`formatShortDate`, `formatShortDateTime`, `activityWhen`). Instants are shown in Europe/Bucharest; civil dates are not shifted.

## Out of scope

Competition lists and forms (#1319/#1320), the course form (#1321), titles/back links (#1323) and dashboards (#1324) are handled separately. Attendance day headings keep their long weekday format because they are headings, not list dates.
