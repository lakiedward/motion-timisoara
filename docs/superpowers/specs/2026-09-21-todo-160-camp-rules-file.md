# To-Do #160 — Fișierul regulamentului taberei

Tracker: To-Do #160, project 16. Extends #155 (text rules). Laki 2026-09-21:
PDF, images, Word (.doc/.docx), Excel (.xls/.xlsx); no video. 10 MB, one file
per camp.

## Storage

Public bucket `camp-rules`, same access model as `camp-photos`: camp pages are
public, so visitors download through `getPublicUrl` without a signed URL.
`announcement-media` stays the private/signed pattern because those files are
photos of children, not public camp documents.

Path: `{camp_id}/{uuid}.{ext}`. Listing stays closed (no public SELECT on
`storage.objects`). Organizer INSERT/DELETE/SELECT is path-scoped with
`pot_administra_tabara`. Bucket `file_size_limit` is 10485760 bytes;
`allowed_mime_types` matches the allowed list. Client validation uses the same
list before upload.

Metadata lives on `camps` (`rules_file_storage_path`, `rules_file_name`,
`rules_file_content_type`, `rules_file_size_bytes`), all null or all set.
`save_camp_offer` does not write these columns, so a later form save does not
wipe a file uploaded from the details step.

Upload copies the `camp-photos` hero sequence: upload the new object, point the
row at it, then delete the previous object. If the row update fails, the new
object is removed in the same turn. Delete clears the row first, then the
object.

## UI

- Organizer wizard (`CampRulesSection` on Detalii): text from #155 plus
  upload / replace / delete. Create holds the file until `save_camp_offer`
  succeeds, then uploads. Edit uploads immediately, like photos.
- Public `CampDetailsPage` / `CampRulesDisplay` and the organizer enrolled
  page show a download/open link with name, type and size when a file exists.
- No enrollment checkbox.

## Not in this change

- Marking To-Do #160 Gata or writing human-gate columns.
- Android document-open proof (browser download at three viewports is the
  recorded gate).
