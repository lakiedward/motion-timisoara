# To-Do #159 — Live save of named camp price components

Owner choice (17 September 2026): merge the three-step wizard, then persist it.
Templates stay later. Existing enrollments and payments are not recalculated.

## Behavior

Create and edit on `/club/camps`, `/coach/camps` and `/admin/camps` keep the
three steps. The last step calls `save_camp_offer`.

- `pricing_mode` is always `by_age`.
- `camps.price` is `0` so it cannot compete with category totals.
- `camp_price_items` is empty for this save path.
- `camp_age_prices.amount` is the sum of that category's named components.
- Component names and amounts are stored on `camp_age_prices.components`.
- `0` remains free. RON/EUR remain.
- Reopening edit shows the same steps with saved details and components.
- The public camp page lists those components under each age category.
- Organizer list cards on `/club/camps`, `/coach/camps` and `/admin/camps`
  count `camp_age_prices` for `by_age` camps and show the min–max of those
  totals with the same en dash as the period on the card. Amount `0` is
  Gratuit. Legacy `single` cards still use `camps.price` and
  `camp_price_items`.
- Camp EUR offers read the BNR daily EUR/RON rate automatically from
  `https://curs.bnr.ro/nbrfxrates.xml` (official XML host since 2026-08-06).
  The cost step shows it read-only as `Curs BNR din <dd.mm.yyyy>: <rate>
  lei/EUR`. There is no manual rate field. A missing feed blocks save with
  retry. The fetched integer millionths are frozen on the offer at save,
  same as the previous typed value. Existing offers and enrollments are
  untouched. Club and coach course forms and the coach activity form use
  the same automatic BNR rate (no typed field).

A missing `components` array on an older save becomes one `Participare` row
with the stored amount, so existing `by_age` camps remain editable.

The git ledger file is `00064_camp_age_price_components.sql`. The already
applied remote remains `20260917133554` (`camp_age_price_components`); do
not re-apply or rewrite it. Prefix `00063` belongs to PR #95
(`00063_demo_source_receipts.sql`, remote `20260917130713`).

## Not in this change

Reusable camp templates. Checkout still quotes the category total, not a
separate component price.
