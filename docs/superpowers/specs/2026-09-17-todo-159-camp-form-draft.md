# To-Do #159 — Local three-step camp form draft

Owner requirement (17 September 2026): the current camp create/edit flow is
unintuitive and must be redesigned before templates. This slice is the
**Design and contract** checkpoint from the daily plan: a navigable local
draft, presented to the owner. The full to-do stays open.

## Behavior in this slice

The shared organizer form (`/club/camps`, `/coach/camps`, `/admin/camps`
create and edit) is a three-step local draft:

1. **Detalii** — title, slug, period, location, capacity, description, rules,
   packing list, cash. Existing photos and coaches stay on this step when
   editing a camp that already exists.
2. **Categorii și costuri** — offer currency (RON/EUR) and age categories.
   Each category has named cost components. Examples in the copy (cazare,
   masă, antrenamente) are not a fixed list. The category total is the sum of
   its components and is not typed separately. `0` remains free (#151).
3. **Verificare** — read-only recap of details, components and totals.

The banner states that this is a **local prototype**. Forward/back keeps the
draft in the form. The last step does **not** call `save_camp_offer`.

There is no global camp price field competing with category totals.

## Save contract (not wired)

`ofertaDinDraft` is the mapping for the next slice:

- `pricing_mode` is always `by_age`.
- `camps.price` is unused by enrollment in that mode; the draft sends `0` so
  it cannot compete with category totals.
- `camp_price_items` (camp-level breakdown) is empty in the new model.
- `camp_age_prices.amount` equals the sum of that category's components.
- Per-category components need a new persistence shape (table or JSON on the
  age row). Until that exists, a live save would keep totals and drop names.

Existing enrollments and payments are not recalculated. Templates (#159
stage 2) stay later.

## Not in this change

Local preview (Vite DEV only): `/dev/camp-form-draft`. Production builds do
not register this path. Club/coach/admin create and edit keep the same wizard.

## Not in this change

- Live save, applying a migration, public/checkout component display,
  migrating existing camps, or reusable camp templates.
