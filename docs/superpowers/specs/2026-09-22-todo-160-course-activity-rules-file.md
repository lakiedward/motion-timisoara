# To-Do #160 — Fișierul regulamentului pe cursuri și activități

Extends the camp rules file on the same branch. One file per course and one
file per activity. Camps stay as they are. Laki 2026-09-21: PDF, images, Word
(.doc/.docx), Excel (.xls/.xlsx); no video. 10 MB.

## Storage

Public buckets `course-rules` and `activity-rules`, same access model as
`camp-rules` and `camp-photos`. Visitors download through `getPublicUrl`.
Listing stays closed. Paths are `{id}/{uuid}.{ext}`. Organizer INSERT, DELETE
and SELECT are path-scoped with `pot_administra_curs` and
`pot_administra_activitate` (owning coach, owning club, or admin).

Metadata columns match camps: `rules_file_storage_path`, `rules_file_name`,
`rules_file_content_type`, `rules_file_size_bytes`, all null or all set.
Course and activity form saves do not write these columns.

Upload copies the camp sequence: upload the new object, point the row at it,
then delete the previous object. A failed row update removes the new object.
Delete clears the row first.

A club that owns an activity may update that row, and a trigger allows only
the four file columns unless the caller is also the activity's coach or is
not a club. Coaches and admins keep full activity updates.

## UI

- Club and coach course forms, and the coach activity form: upload, replace
  and delete. Create holds the file until the offer exists, then uploads.
  Edit uploads immediately.
- Club activities list (`/club/activities`) opens the file control for an
  activity the club owns. Clubs do not create activities here.
- Public course and activity pages show the download link with name, type and
  size. No enrollment checkbox.

## Not in this change

- Marking To-Do #160 Gata or writing human-gate columns.
- Re-applying migration `00065`.
- Competition templates, parent camp enrollment, or Apple sign-in.
