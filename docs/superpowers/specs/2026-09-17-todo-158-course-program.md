# To-Do #158 — Program obligatoriu la curs

Owner requirement (17 September 2026): a course cannot be created without an
explicit weekly program — weekdays and hours. The saved program is used to
generate the course sessions. Native is the primary launch target.

## Behavior

- Coach and club create/edit (`/coach/courses`, `/club/courses`) share one
  **Program** fieldset.
- The organizer selects weekdays and fills start/end for each selected day.
  Inputs stay native `type="time"` so Capacitor keeps the platform pickers.
- Save is blocked when no day is selected, when a selected day is missing hours,
  or when end is not after start. The form states what is missing.
- Days and hours that the organizer did not fill are not invented.
- The program is stored as `courses.recurrence_rule` JSON
  `{ "daySchedules": { "1": { "start": "18:00", "end": "19:30" } } }`
  with ISO weekdays Monday=1 … Sunday=7, matching the original course contract.
- After a successful save, future `course_occurrences` are regenerated for the
  next eight weeks in `Europe/Bucharest`. Past sessions stay untouched. Future
  sessions that already have attendance stay; other future sessions are replaced
  to match the new program.

## Not in this change

- Admin create/edit of courses (the React admin portal only lists and toggles).
- A JavaScript time-picker library or a new schedule table.
- Changing how public course pages label weekdays.
