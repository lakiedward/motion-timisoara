# Course session packages: definition and display (TT feature #696)

Owner request 2026-11-20: a coach or club defines packages on a course (for example 8 sessions at a total price). Owner decisions from the same day: parents see the word „pachet”, never „abonament”; validity is either no expiry or the calendar month; where a course has packages they replace the per-session price, and courses without packages keep working as today. Proposal: `/mnt/project-files/research/pachete-sedinte-curs.md`.

This slice (#696) covers defining packages and preparing their display. Buying a package at checkout is #697; the monthly expiry and attendance consumption are #698.

## Data model

New table `public.course_packages` (migration `00148`): `course_id` (cascade with the course), `position` 0–3 (unique per course, so at most 4 packages), `sessions` 1–100, `price` in the course currency's minor units like `courses.price_per_session`, `validity` `NONE` or `CALENDAR_MONTH`, timestamps.

- Anyone who can read the course reads its packages (the policy reuses the `courses` RLS through a subquery).
- Clients have no INSERT/UPDATE/DELETE grant. `save_course_packages(course_id, jsonb)` (SECURITY DEFINER, `search_path = ''`) checks `pot_administra_curs` (course coach, owner of the course's club or admin, active account), locks the course row and replaces the list in one transaction, keeping the ids of edited packages so #697 can reference them.
- `CALENDAR_MONTH` is already a valid value so #697/#698 do not reshape the table, but the save function refuses it until #698 ships the expiry (`0A000`).

Why not `courses.package_options`: it is untyped text that the current checkout already reads as a list of session counts. Writing prices there would immediately change the live checkout (parents would see the package sizes but still pay per session), it cannot hold constraints or RLS of its own, and future purchases need a stable package id to reference.

## UI

- `CoursePackagesFields` is one shared section „Pachete” (`data-section="course-form-packages"`) in the coach form and in the club/admin form, after „Preț”. It follows the camp age-category editor: bordered rows with a numbered heading and a delete icon, an outline „Adaugă un pachet” button, disabled at 4. Each row shows the derived price per session.
- Only „Fără expirare” packages can be created now; the validity choice appears with #698, so coaches cannot promise a monthly expiry that is not enforced yet.
- The course enroll card can show „de la X / ședință” and the package list (`data-section="course-enroll-packages"`), but only when `COURSE_PACKAGES_ON_SALE` is true. It stays false until #697 makes checkout sell the packages, so the course page never advertises a price the parent cannot pay. The form tells the coach this.

## Checks

Isolated SQL test `supabase/tests/course-packages.sql` (permissions, replace/reorder/delete, limits, monthly refusal, cross-course ids, visibility); unit tests for the schema helpers; form and enroll-card component tests.
