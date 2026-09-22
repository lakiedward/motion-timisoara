# To-Do #152 — Parent as adult camp participant

Owner intent (22 September 2026):

1. Adult tariff is a dedicated camp price, modelled like an age category
   (named components, total, RON/EUR, `0` = Gratuit), shown next to the age
   categories on the organizer form.
2. An enrolled adult occupies one seat from `camps.capacity`, same as a child.

## Persist

- Table `camp_adult_prices`: one optional row per camp (`amount` + `components`).
- `enrollments.child_id` becomes nullable; `adult_profile_id` points at the
  authenticated parent's `profiles.id`. Exactly one subject: child XOR adult,
  and adult only when `kind = 'CAMP'`.
- Quote RPC `enrollment_camp_adult_offer(camp)`; child path
  `enrollment_camp_offer(camp, child)` is unchanged.
- `save_enrollment_batch` accepts adult quotes beside child quotes.
- Price snapshots keep `schemaVersion` 1. Child snapshots stay byte-compatible.
  Adult snapshots set `childId` JSON null and `adultProfileId`.
- Capacity counters already count CAMP `PENDING`+`ACTIVE` rows; adult rows
  occupy a seat with no extra counter.

## Product

- Organizer camp wizard always edits the adult category next to age categories.
- Public camp page lists the adult tariff when the row exists.
- Checkout (CAMP) adds „Mă înscriu și eu”. Adult-only is allowed. One active
  or pending adult enrollment per parent per camp.
- Organizer enrolled list shows adults with badge Adult; child fields (QR,
  allergies, t-shirt) stay child-only.
- Courses and activities stay child-only.

## Out of scope

- Live Stripe charge in verification.
- Canonical `tt_ui_surfaces` while this lives only on the PR.
- Camp templates, live-location adult participation, adult medical data.
