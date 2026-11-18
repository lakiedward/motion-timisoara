# Club attendance (`/club/attendance`)

Owner request, 2026-11-18: the club account has no manual attendance. Team Tracker To-Do #519 (courses), feature #522 point 1 (activities), To-Do #520 (verification).

## Why it was missing

The legacy app had `/club/attendance-payments`. The rebuild kept only the cash part (`/club/payments`). `record_attendance_transaction` accepted only the course coach and ADMIN, and the club could not read who is enrolled in its activities, so no club screen could have saved anything.

## Behaviour

- New entry „Prezență” in the club menu (group „Organizare”, after „Antrenori”), route `/club/attendance`, behind the club approval gate.
- Switch „Cursuri / Activități”, the same control as on the coach page.
- Courses: the admin attendance layout (`SessionsOverview`, extracted from `AdminAttendancePage`), filtered to the club and grouped by coach. Same filters, badges, roster and „Toți prezenți”. Marking opens when the session starts, as for the coach and the admin.
- Activities: the coach list and roster (`ActivityAttendance`, `ActivityRoster`), fed with the club's activities.
- The club marks manually only. QR scanning, the entrance code and live location stay with the coach.

## Server

- `00144_club_manual_attendance.sql`: `record_attendance_transaction` also accepts an enabled CLUB account that owns the approved club of the course. A club request with `qrToken` is refused. Balance rules, receipts, locks and the start-time guard are unchanged. The function is replaced only if the live source is the one from 00105.
- `00145_club_activity_attendance_roster.sql`: `activity_attendance_roster(uuid)` returns child id, name, birth date and mark for ACTIVE enrollments of an activity the caller administers. Policies on `enrollments` and `children` are not widened, the same choice as 00128.
- `record-attendance` edge function is unchanged; it forwards the caller to the transaction.

## Tradeoffs

- Grouping by coach reuses `SessionGroupCard` unchanged and answers the club's question „which coach has unmarked sessions”. A flat list would have needed a new component.
- The coach activity roster keeps its direct table read, so the coach page does not depend on the new function being applied before the web deploy.
- The club may also correct a mark made by the coach; the last manual change wins, as between coach and admin today.

## Checks

`supabase/tests/transactional-attendance.sql` (club cases), `supabase/tests/club-activity-attendance-roster.sql`, `ClubAttendancePage.test.tsx`, `admin-sessions.test.ts`, browser check at 1440×900, 768×1024 and 375×812.
