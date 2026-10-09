# Club profile page

UI sections #495 (Date publice) and #773 (Contact și facturare) on `/club/profile`. The owner approved criteria #2043–#2056 on 2026-10-09; on the same day the owner removed the billing card, so criteria #2055 and #2056 were deleted. Feature #437, a warning about unsaved changes, was deferred.

The page moved to `features/club/profile/`.

**Loading and errors.** A failed `my_club` request now shows an error with retry instead of «Niciun club asociat.», which stays reserved for an account without a club. Loading has a labelled skeleton.

**Validation** lives in `clubProfileSchema.ts`. Website is optional and labelled so; when filled, «https://» is added if missing and the result must be an http(s) URL with a dotted host. An empty website is saved as null.

**Billing card removed.** The company name, CUI, bank and IBAN fields were not used anywhere in the product: card payments go through Stripe Connect, where the club enters its company and bank details, and cash payments need none. The card and `ClubProfileInput`'s billing fields are gone, so the form no longer sends those columns and existing values stay untouched in the database. The columns themselves remain.

After a successful save, the form shows the stored, normalised website. A failed save keeps what was typed. An image change refetches the club, but fields the user is editing are preserved (`keepDirtyValues`).

**Address with map.** At the owner's request, Oraș and Adresă became the location form's selector (`ClubAddressFields`): county and city dropdowns plus `LocationPicker`, where the club searches an address or places or drags a marker and the reverse lookup fills address, city and county. Criterion #2053 (free-text city and address) was replaced by #2066 and #2067. Migration `00086_club_location.sql` adds `clubs.county`, `lat` and `lng`; the point is saved with the profile and restores the marker, but coordinates are never shown, as the owner asked. The public club page (#650) now shows the address in the contact card and, when a point exists, a small non-draggable map with a pin (`ClubLocationMap`). The shared picker keeps the location form's 36 px desktop height for its selects and address input; the profile's own fields stay at 44 px.

**Form layout.**
- Section headings use the club pages' heading style.
- Fields and buttons have 44 px targets, and the consent row is a 44 px clickable label.
- A hint says where the description appears.
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
