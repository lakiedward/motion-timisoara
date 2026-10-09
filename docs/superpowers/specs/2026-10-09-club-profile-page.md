# Club profile page

UI sections #495 (Date publice) and #773 (Contact și facturare) on `/club/profile`. The owner approved criteria #2043–#2056 on 2026-10-09. Feature #437, a warning about unsaved changes, was deferred.

The page moved to `features/club/profile/`.

**Loading and errors.** A failed `my_club` request now shows an error with retry instead of «Niciun club asociat.», which stays reserved for an account without a club. Loading has a labelled skeleton.

**Validation** lives in `clubProfileSchema.ts`:
- Website: «https://» is added when missing, and the result must be an http(s) URL with a dotted host.
- IBAN: must be a Romanian IBAN, checked with ISO 13616 mod-97, and is stored uppercase without spaces.
- CUI: digits with an optional «RO» prefix, stored the same way.
- Empty optional fields stay allowed.

After a successful save, the form shows the stored, normalised values. A failed save keeps what was typed. An image change refetches the club, but fields the user is editing are preserved (`keepDirtyValues`).

**Form layout.**
- Section headings use the club pages' heading style.
- Fields and buttons have 44 px targets, and the consent row is a 44 px clickable label.
- Hints say where the description appears and that billing data is private.
- A «Vezi pagina publică» link opens `/cluburi/:id`.

**Logo and cover.** These existed on the public page with no way to set them. `ClubImageField` uploads them immediately, separate from the form's Save, through `api/club-images.ts`:
1. The image is resized with `micsoreazaPoza`.
2. It is stored as `club-assets/{clubId}/{logo|hero}/{uuid}.jpg`.
3. The club row is updated, and the new file is removed again if that update fails.
4. The previous file is removed best-effort.

On native the gallery picker is used, as in `HeroPhotoField`.

Known storage limits, unchanged here (bug #1147):
- The `club-assets` write policies only check the CLUB role, not ownership of the `{clubId}` folder.
- The bucket has no owner SELECT policy, so the best-effort delete of replaced files is likely a no-op and old files remain.
