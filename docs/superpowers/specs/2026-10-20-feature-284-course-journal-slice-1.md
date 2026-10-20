# Feature #284 — Course journal, slice 1: club upload in the announcement form

## Accepted scope

Owner decisions of 2026-08-26 (recorded on feature #284) and the correction of 2026-08-31 apply: photos and videos are uploaded to the private `announcement-media` bucket, at most 6 photos resized in the browser to 1600 px and one video of at most 60 s and 50 MB per announcement, rejected before upload with a clear message. Only videos expire, after 30 days. Delivery plan v30 item 1066 asks for this slice: the specification, the data model and the club upload. Section #3925 "Formular anunț nou" (criteria 2721–2734, approved 2026-10-20) defines how the form looks and behaves; on 2026-10-20 the owner chose a compact grid for the selected files.

## Already in production

- Migration 00022 (`20260826100816`): `announcement_attachments.club_announcement_id` with `ON DELETE CASCADE`, exactly one owner column enforced by `announcement_attachments_owner_ck`, and `expires_at` for videos, indexed.
- Migration 00023 (`20260826100903`): storage policies follow the announcement. A file is readable when its first path segment is an announcement the reader can see; the announcement RLS limits that to the parents with an active enrollment, the owning club and ADMIN. Upload and delete belong to the announcement owner or ADMIN.
- Migration 00024 (`20260827083602`) and the `purge-expired-media` edge function: a daily job deletes expired video files and rows.
- `src/lib/media.ts` validates and resizes before upload; `src/api/attachments.ts` uploads, rolls back uploaded files when the row insert fails, and serves signed links valid for one hour.

Slice 1 needed no migration for the upload itself.

## Course coach read access

A read-only impersonation in production on 2026-10-20 showed the coach of a targeted course could not read the club announcement or its files, although this slice's scope names the coach among the readers. Migration 00097 (approved by the owner on 2026-10-20) adds the coach of the targeted course to `club_announcements_select`, for published announcements only, and only when the course belongs to the announcing club; club-wide, activity and camp announcements stay as before. The attachment and storage policies follow the announcement, so the coach reads the files too. `supabase/tests/club-announcement-coach-read.sql` covers the course coach, a coach of an untargeted course, the enrolled parent and a parent of another course.

## This change

- The compose form moves from `ClubAnnouncementsPage.tsx` to `src/features/club/announcements/AnnouncementComposeForm.tsx`, so the announcement list (section #487) and the form can change independently.
- The form is a flat `Card` titled "Anunț nou" with a sentence on where the announcement goes, uses `Input`, `Textarea` and `FieldMessage`, keeps every field and select at 44 px with 16 px text, focuses the first invalid field, and shows "Se publică…" while publishing.
- `AnnouncementMediaPicker` replaces the native file input with the outline button "Adaugă poze sau filmare" on web and native, then shows a compact grid of square previews, three per row on phones and five on wider screens, with the size (and duration for the video) under each and a 44 px remove control on its corner whose accessible name carries the file name. The owner chose this compact grid over larger tiles with visible file names because six photos and a video made the form about 1540 px tall on a phone; the compact grid saves about 445 px. Tiles follow the camp and competition gallery pattern. A counter shows photos and video against their limits and, once a video is chosen, the date it will be deleted.
- `FisierPregatit` carries the measured video duration so the preview can show it.

## Open item found during this slice

The production Vault has no `service_role_key`, so `cheama_purge_expired_media()` exits with a warning and the daily job never calls the edge function. Two videos are already past `expires_at` and still stored. Adding the secret is an owner action in the Supabase dashboard; it belongs to the retention slice.

## Later slices

Parent display already renders club attachments (#544). Remaining: signed-link download for parents before deletion, the coach announcement page (new surface with its own criteria), working retention (Vault secret above), and impersonation proof of who can and cannot read the files on the final data.

## Verification

- Unit tests: picker (Romanian button, previews with name, size and remove, video rejection over 50 MB) and form (flat Card and title, error icon and focus, "Se publică…"), plus the existing page tests.
- Browser at 1440×900, 768×1024 and 375×812 in both themes on `/club/announcements` with the CLUB account, local and on the deploy preview; no real announcement is published during verification.
