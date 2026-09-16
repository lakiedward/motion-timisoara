# To-Do #151 — Categorii de vârstă gratuite

Owner requirement: a camp can have a free age category, for example 0–2, with the
interval chosen per camp. Zero must survive display, enrollment and the total.

## Behavior

- Club/coach age rows already accept `amount = 0`. The form now states that 0 means
  free, and **Marchează gratuit** writes `0`.
- Public tariffs and checkout show **Gratuit** instead of `0,00 lei`.
- Checkout can continue when the confirmed total is 0. Card billing is skipped.
- `save_enrollment_batch` (migration `00061`, not applied live) activates a 0 RON
  quote immediately and only asks for a payment intent when some child still owes
  money.

## Not in this change

- Applying `00061` or deploying `create-enrollment` on the product project.
- Mandatory camp-rules acceptance; that is To-Do #155.
