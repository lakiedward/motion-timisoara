# Admin attendance (#271 part 5)

Approved by the owner on 2026-10-20 (direction A, grouped by organizer; Team Tracker section 4062, criteria 2831–2836).

## Goal

Admins can see and record attendance for every course session of every club and independent coach, without logging in as the coach.

## Design

- Route `/admin/attendance`, navigation item "Prezență" after "Anunțuri" (12 admin destinations; #752 criterion 1870 updated).
- Window: sessions starting in the last 30 days and the next 30 days (`ADMIN_SESSION_WINDOW_DAYS`), read with pagination.
- Grouping: Cluburi first, then Antrenori independenți. One collapsible card per organizer with "X nepontate din Y" and a preview of 5 sessions plus "Vezi toate cele N", the same pattern as admin courses, activities and announcements.
- Filters: search (course, organizer, coach, location), status pills Nepontate (default), Azi, Următoare, Trecute, Toate, and a Sport filter through the shared `CourseFilterBar`.
- A session is "unmarked" when it has started, has enrolled children and fewer attendance rows than enrolled children.
- "Pontează" expands the roster inline; Prezent/Absent per child (second press clears), "Toți prezenți" for unmarked children.

## Data and access

- Reads: `course_occurrences` (select is public), `enrollments`, `attendance`, `children`; ADMIN is covered by the existing select policies.
- Writes reuse `record-attendance` → `record_attendance_transaction`, which already accepts role ADMIN for any occurrence and applies the same subscription accounting as for coaches. No migration.

## Out of scope

- QR scanning and live location from the coach page: they are field tools for the coach's phone.
- Sessions older than 30 days.
- The coach attendance page is not changed, so its accepted section keeps its fingerprint.
