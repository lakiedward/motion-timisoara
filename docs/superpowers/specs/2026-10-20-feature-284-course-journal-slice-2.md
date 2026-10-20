# Feature #284 — Course journal, slice 2: the coach announcement page

## Why this slice

Slice 1 left three items: signed-link download for parents, the coach announcement page and working retention. Download already exists on the parent card (`AnnouncementMedia` renders a "Descarcă" link on every video with its deletion date), and retention waits on the owner adding `service_role_key` to the Vault. The coach page is the remaining build item and the only one the feature names as a new surface (point 6 of #284).

## No migration

Production policies checked read-only on 2026-10-20:

- `course_announcements`: the course coach inserts (as author), updates and deletes on their own courses; parents with an active enrollment, the course coach and ADMIN read.
- `announcement_attachments` and the `announcement-media` storage policies already let the course coach insert, read and delete files of their course announcements.
- Migration 00097 lets the course coach read club announcements published for that course; `clubs` is readable by everyone.
- `get_parent_announcement_feed` already returns coach announcements (`source = 'coach'`), and the push trigger `capture_course_announcement_push` already notifies parents.

## This change

- New route `/coach/announcements`, entry "Anunțuri" in the coach navigation (group Organizare, same Megaphone icon as the club).
- `src/api/coach-announcements.ts` reads the coach's course announcements and the club announcements aimed at those courses into one list, creates, pins/unpins and deletes course announcements.
- `incarcaAtasamente` and `stergeFisiereleAnuntului` take the announcement source, so the coach's files go to `announcement_id`.
- Compose form: flat Card "Anunț nou" like the club form, with course select (active courses, preselected when there is one), text, the shared `AnnouncementMediaPicker` (same limits: 6 photos at 1600 px, one video ≤ 60 s and ≤ 50 MB) and "Fixează sus la părinți".
- List: the shared filter bar (`CourseFilterBar`, now with configurable label for its second row) with search, source pills Toate / Ale mele / De la club with counts and a course row (pills from 768 px, select below). Pinned announcements come first in "Fixate sus", the rest grouped by month, 15 at a time with "Arată încă". Club announcements are read-only and say so.
- Two directions for the owner: A keeps the form always open above the list (as on `/club/announcements`); B puts an "Anunț nou" button in the header and shows shorter cards (two text lines, "Vezi tot și N atașamente"). Until the owner chooses, `?v=b` shows B; the losing direction and the switch are removed before merge.

## Verification

- Unit tests for filters, grouping and the coach attachment column.
- Browser at 1440×900, 768×1024 and 375×812, light and dark, with 43 mocked announcements (the test coach has no courses in production, and no real announcement is published during verification).
