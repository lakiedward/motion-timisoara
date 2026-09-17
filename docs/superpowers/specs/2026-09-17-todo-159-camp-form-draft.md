# To-Do #159 — Local three-step camp form draft

Owner requirement (17 September 2026): the current camp create/edit flow is
unintuitive and must be redesigned before templates. This slice is the
**Design and contract** checkpoint from the daily plan: a navigable local
draft, presented to the owner.

Live save of named components is specified in
`docs/superpowers/specs/2026-09-17-todo-159-camp-form-live-save.md`.

## Behavior in this slice

The shared organizer form (`/club/camps`, `/coach/camps`, `/admin/camps`
create and edit) is a three-step draft:

1. **Detalii** — title, slug, period, location, capacity, description, rules,
   packing list, cash. Existing photos and coaches stay on this step when
   editing a camp that already exists.
2. **Categorii și costuri** — offer currency (RON/EUR) and age categories.
   Each category has named cost components. Examples in the copy (cazare,
   masă, antrenamente) are not a fixed list. The category total is the sum of
   its components and is not typed separately. `0` remains free (#151).
3. **Verificare** — read-only recap of details, components and totals.

There is no global camp price field competing with category totals.

Local preview (Vite DEV only): `/dev/camp-form-draft`. Production builds do
not register this path.
