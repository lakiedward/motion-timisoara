# To-Do #159 — Reusable camp templates

Owner choice (22 September 2026): options 1A, 2A, 3A and 4A.

## Behavior

A template is a snapshot. It belongs to the same owner as a camp: a club sees only its templates, a coach only their own, and an admin only the templates stored on the admin account (the same `coach_id` the admin camp form already uses). Templates are not shared with a club's coaches and there is no platform catalog.

The snapshot includes currency, age categories with named components and amounts, description, rules text, packing list, cash, location, location text and capacity. It does not include the title, page slug, period, rules file, photos, coaches or the BNR rate. Amounts stay in the template currency. A new EUR camp reads the live BNR rate when that camp is saved.

On an existing camp's edit form, **Salvează ca șablon** asks for a name (default: the camp title) and stores the configuration currently on the form. The same name for the same owner replaces that snapshot and keeps its id. The camp row is not saved by this action.

On **Tabără nouă**, above the steps, **Pornește de la un șablon** lists the owner's templates plus **Formular gol**. Choosing one fills only the copied fields. Title, slug and period stay as typed. If the form already has data, the choice asks for confirmation first. **Șterge** removes the template and leaves camps created from it unchanged. There is no separate template editor.

The same controls are on `/club/camps`, `/coach/camps` and `/admin/camps`, in the browser and in the Capacitor app.

## Persistence

`00069_camp_templates.sql` adds `camp_templates` with owner RLS, a partial unique name per owner, and `save_camp_template` (security invoker) for the insert-or-replace. Deleting a location clears `location_id`. Deleting the owner removes the templates. Camps do not reference templates.
