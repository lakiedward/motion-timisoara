# Styled date and time pickers in admin, coach and club forms

Date: 2026-11-02. Owner choice: variant A ("ca listele noi"), picked from three directions with screenshots.

## Problem

The admin, coach and club forms used native `type="date"`, `type="time"` and `type="datetime-local"` inputs. They open the browser calendar, which does not match the site and, on some systems, shows English placeholders (`mm/dd/yyyy`).

## Decision

- `DatePicker` (`src/components/ui/date-picker.tsx`): trigger styled like the variant A `SelectMenu` (rounded-xl, 44px, border-primary when open), Radix Popover card with a Monday-first Romanian month grid, `Azi` and optional `Șterge`. Supports `min`/`max`; keyboard: arrows move by day/week, PageUp/PageDown by month, Enter picks.
- `TimePicker` (`src/components/ui/time-picker.tsx`): same trigger, list of 15-minute slots with a check on the selected one, plus a "Scrie ora" field for any exact time (e.g. 10:10). An existing off-grid value stays in the list. Opens scrolled to the selected time or 08:00.
- `DateTimePicker` composes both for the invite-code expiry and keeps the `YYYY-MM-DDTHH:MM` value.
- Values keep the same strings as the native inputs (`YYYY-MM-DD`, `HH:MM`), so schemas, API code and saved data do not change. Forms wire the pickers through react-hook-form `Controller`.

## Scope

Activities (coach, club, admin), course program hours, camp period, competition schedule, invite-code expiry. Parent birth-date fields stay native, as recommended by the public/parent audit.

## Tradeoffs

- Adds `@radix-ui/react-popover`: a calendar grid is not a menu, so the DropdownMenu used by `SelectMenu` would fight its keyboard model.
- Removed the invite-code "partial native datetime" guard: the picker can no longer produce a partial value.
