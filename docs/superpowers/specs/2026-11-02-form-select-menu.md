# Styled selects in coach, club, camp and competition forms

Date: 2026-11-02. Owner choice: variant A (styled list that opens as a site card), first used in the public list filters (PR #359).

## Scope

Every native `<select>` in the coach and club panels and in the shared course, activity, location, camp, competition and podium forms moves to `SelectMenu` (`src/components/ui/select-menu.tsx`). Admin-only selects belong to the admin thread; the filter bars belong to the filters thread.

## Decisions

- `searchable` adds a search box at the top of the open list. The match ignores case and Romanian diacritics (`src/lib/select-search.ts`). It is on for Județ, Oraș and location organizer, and for coach, location, recipient and participant lists longer than 8 entries.
- Option groups (`groups`) replace `<optgroup>` for location organizer, location type and announcement recipients.
- `FormSelectMenu` connects a select to react-hook-form with `useController`. It registers `''` when the form has no default, as a native select did, so zod keeps reporting refinements such as the course program next to missing fields.
- In forms the trigger uses the input radius, padding and dark background (`formSelectMenuClassName`), so a select and a text input on the same row look the same. The open list keeps the variant A look.
- The "copy categories from another camp" control stays a select that resets after each choice; it is an action, but a menu would need a new pattern.

## Tests

`src/test/select-menu.ts` holds helpers to pick by value (`data-value` on items and trigger), read option labels and wait for an option.
