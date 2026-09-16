# To-Do #150 — Intervalul taberei

Owner requirement: choosing the camp start and end should be easier and more
intuitive. The visual solution is chosen at implementation after inspecting the
existing form. Native is the primary launch target.

## Behavior

- The camp form groups start and end in one **Perioada taberei** fieldset.
- Inputs stay native `type="date"` so Capacitor keeps the platform pickers.
- Picking a start that is after the current end moves the end to that start.
- The inclusive length is shown immediately (`8 zile`). Shortcuts set 7, 8 or 14
  days from the chosen start.
- Stored values remain `period_start` / `period_end` ISO dates. Zod still rejects
  an end before the start.
- Club, coach, and admin camp create/edit use the same fieldset:
  `/club/camps/new|:id/edit`, `/coach/camps/new|:id/edit`,
  `/admin/camps/new|:id/edit`.

## Not in this change

- A JavaScript calendar grid or a new date-picker dependency.
- Changing how public camp pages display the saved interval.
