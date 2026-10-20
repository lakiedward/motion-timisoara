# Shared location catalog (option B)

Owner decision 2026-10-20 09:17:47Z, card "Cum lucrăm cu locațiile folosite de mai mulți organizatori?": option B, "catalog comun de locații". Anyone can pick any location, and the admin approves new ones. This needs a migration, so it ships after the 2026-11-01 launch. This document is the design only; nothing here is implemented.

Research behind it: `/mnt/project-files/research/locatii-logica.md`.

## Why

Today a location has an owner: a club (`club_id`) or its creator (`created_by_user_id`). Only the admin can make a location common. In Timișoara, most pools and halls are municipal or rented by several clubs, so each club creates its own copy. Live data already has "Bazin Olimpia" (club) next to "Bazin Olimpic Timișoara" (common). The owner can also deactivate a location, or move its address, while other organizers' courses use it. Picker restrictions exist only in the UI.

## Model

A location is a place in the city, not an organizer's property.

`public.locations` keeps its id, so every foreign key stays valid. It gains these columns:

| Column | Type | Meaning |
|---|---|---|
| `status` | `text NOT NULL DEFAULT 'PENDING'`, CHECK in `PENDING`, `APPROVED`, `REJECTED`, `MERGED` | catalog state |
| `reviewed_by_user_id` | `uuid REFERENCES profiles(id) ON DELETE SET NULL` | admin who approved, rejected or merged it |
| `reviewed_at` | `timestamptz` | when that happened |
| `review_note` | `text` | rejection reason shown to the proposer |
| `merged_into_id` | `uuid REFERENCES locations(id) ON DELETE SET NULL` | target of a merge |

The other columns change meaning:

- `created_by_user_id` means "proposed by". It no longer gives edit rights after approval.
- `club_id` means "proposed by this club". It no longer gives rights or decides who can pick the location. It stays during the transition. A later migration drops it after nothing reads it.
- `is_active` stays. Only the admin changes it on an approved location.
- `lat`/`lng` become required for new proposals, enforced by a CHECK that applies only to `PENDING` rows inserted after the migration (`NOT VALID` for old rows).

Indexes:

- `status`;
- a GIN trigram index on `lower(unaccent(name))` for duplicate search, if `pg_trgm`/`unaccent` are available; otherwise the existing `fts`.

## Migration (one append-only file)

1. Add the columns.
2. Mark every existing row `APPROVED` with `reviewed_at = now()`, because they are all in use.
3. Add the merge function and the write guards below.
4. Replace the location RLS policies.
5. Regenerate `src/lib/database.types.ts` and update `supabase/migrations/README.md`.

Merging the existing duplicates is a data operation. It runs after the migration through the admin merge action, with an owner card per pair, and never inside the migration. The known candidate is "Bazin Olimpia" into "Bazin Olimpic Timișoara". The owner confirms it is the same pool, because "Bazin Olimpia" has no coordinates.

### `public.merge_locations(p_from uuid, p_into uuid)`

The function is `SECURITY DEFINER`, admin only (`get_my_role() = 'ADMIN'`), and runs in one transaction:

- It refuses when `p_from = p_into`, when the target is not `APPROVED`, or when the target is itself merged.
- It repoints `courses`, `activities`, `camps`, `camp_templates` and `competitions` from `p_from` to `p_into`.
- It moves `user_recent_locations` and deletes rows that would break `UNIQUE(user_id, location_id)`, keeping the higher `use_count`.
- It sets `p_from` to `status = 'MERGED'`, `merged_into_id = p_into`, `is_active = false`, with the reviewer and the time.
- It writes an `audit_logs` row with the counts of moved rows.
- It returns those counts so the admin UI can show them.

## Approval flow

1. **Propose.** A coach, club or admin types a name in any location picker. Before "Propune o locație nouă" appears, the picker shows matches from the whole catalog by name (diacritics-insensitive) and by distance (within 100 m once a pin is set). This reuses `findNearbyLocations` from `features/club/location-form/` and moves it to a shared folder.
2. **Use at once.** A `PENDING` location can be used immediately on the proposer's own courses, activities, camps and competitions, so nobody waits on the admin. It appears on those offers' public pages, but not on /harta and not in other organizers' pickers.
3. **Review.** The admin dashboard shows "Locații de aprobat · N". On /admin/locations the admin can:
   - **Aprobă**: the location becomes `APPROVED` and visible to everyone and on the map.
   - **Unește cu…**: the admin picks an approved location; `merge_locations` repoints everything.
   - **Respinge**: the admin writes a reason. This is allowed only when no active offer uses the location; otherwise the admin must merge.
4. **After approval** only the admin edits or deactivates the location. Organizers report a wrong address or a closed venue through the existing contact flow, and a "Raportează o problemă" button is a follow-up.
5. **Deactivation** of a location used by active offers asks the admin to merge it into another location or to confirm, showing every affected organizer and offer.

Notifications to the proposer (email/push) are not in scope. The proposer sees the status on their location list.

## RLS

The policies on `locations` are rewritten:

- **SELECT** (`anon`, `authenticated`):
  - `status = 'APPROVED' AND is_active`;
  - or the caller proposed it (`created_by_user_id = auth.uid()` or `club_id IN my_club_ids()`);
  - or the caller is ADMIN;
  - or `public.location_is_referenced(id)` (`SECURITY DEFINER`): an active course, activity, camp or competition points at it, so public offer pages keep showing pending or deactivated locations.
- **INSERT** (`authenticated`, role COACH, CLUB or ADMIN): `created_by_user_id = auth.uid()`. Non-admins must insert `status = 'PENDING'` with null review columns and no `merged_into_id`. `club_id`, if set, must be in `my_club_ids()`.
- **UPDATE**:
  - ADMIN, any row;
  - the proposer, only while `status = 'PENDING'`.
  
  A `BEFORE UPDATE` trigger stops non-admins from changing `status`, the review columns, `merged_into_id`, `is_active`, `created_by_user_id` and `club_id`. Today the creator can also rewrite `club_id`; this closes that gap.
- **DELETE**:
  - ADMIN;
  - the proposer while `PENDING`, which the foreign keys already block when the location is in use.

Offer tables get a `BEFORE INSERT OR UPDATE OF location_id` trigger, `ensure_location_usable`, on `courses`, `activities`, `camps` and `competitions`. The location must be:

- `APPROVED` and active;
- or `PENDING` and proposed by the caller or the caller's club;
- or the row is unchanged (`OLD.location_id = NEW.location_id`), so old offers stay editable after deactivation;
- or the caller is ADMIN.

This moves the picker rule from the UI into the database.

## Pages that change

| Area | Files | Change |
|---|---|---|
| Shared picker | new `src/features/locations/` (picker, duplicate search, propose form), replacing the location `<select>`s in `features/coach/CourseFormPage.tsx`, `ActivityFormPage.tsx`, `features/club/ClubCourseFormPage.tsx` + `course-form/useCourseFormOwner.ts`, `features/camps/CampFormDetailsStep.tsx`, `features/competitions/form/CompetitionScheduleSection.tsx` | One searchable picker over the whole catalog (it must stay usable with hundreds of locations), with "Propune o locație nouă" inline. `getSelectableLocations` and `getClubSelectableLocations` merge into one catalog query in a new `src/api/locations.ts`. |
| Coach | `features/coach/CoachLocationsPage.tsx`, `LocationFormPage.tsx`, `api/coach.ts` | Becomes "Locațiile mele": locations used by my offers plus my proposals with status (În așteptare / Aprobată / Respinsă + motiv). Edit only while pending; no Activează/Dezactivează. |
| Club | `features/club/ClubLocationsPage.tsx`, `ClubLocationFormPage.tsx`, `locations/*`, `location-form/*`, `api/club.ts` | Same as coach, for the club. Keeps the shared filter bar. The deactivate dialog goes away. |
| Admin | `/admin/locations` (built by #271 part 2), `AdminDashboard.tsx` | Becomes the catalog: status pills "De aprobat · N / Aprobate / Inactive / Unite", search, "Folosită de" (organizers), filter by organizer, actions Aprobă / Respinge / Unește cu… / Editează / Dezactivează. The dashboard gets a "Locații de aprobat" counter. |
| Public | `api/public.ts` `getLocations`, `features/public/MapPage.tsx`, `map/*` | The map shows only `APPROVED` and active locations. Offer pages keep reading the joined location. |

Both themes, the 44 px touch targets and the design-system flat cards apply as on the other list pages. Every list keeps search and filters.

## Rollout

1. Migration and backend guards, with SQL tests for RLS and the triggers per role.
2. Shared picker in the offer forms.
3. Admin catalog and approval.
4. Coach and club "Locațiile mele".
5. Duplicate merges, one owner card per pair.
6. Drop `club_id` from `locations` in a later migration, once nothing reads it.

Each step is its own PR and Team Tracker item. Steps 1–2 must ship together, because the old club picker filter relies on `club_id`.

## Not included

- Opening hours and lane or court booking.
- Several addresses per venue.
- Notifications to proposers.
- A public "report a problem" form.
- Organizer-private locations. If a club ever needs a private gym, it stays in the catalog as a normal approved location.
