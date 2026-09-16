# To-Do #155 — Secțiunea Regulament

Owner requirement: each camp has a separate Regulament section. The organizer
edits the text; visitors read it on the public camp page. No mandatory
acceptance and no file format yet.

## Behavior

- `camps.rules` is nullable text, at most 8000 characters. Blank input stores
  null. `save_camp_offer` writes the field only when the metadata JSON contains
  `rules`, so older clients do not wipe it.
- The camp form has a Regulament fieldset. The public page shows the heading
  only when the text is present, preserving line breaks.
- Migration `00062` is shipped and not applied. Public reads use `select('*')`,
  so camp pages keep working before the column exists; persistence starts after
  apply.

## Not in this change

- Applying `00062` on the product project.
- Checkbox acceptance at checkout, PDF upload or rich text.
