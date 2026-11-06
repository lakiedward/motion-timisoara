# Competition routes with their own age categories

Requested by the owner on 2026-11-06: each route has several age categories, each with its own price, and the same age may appear on more than one route. At registration the parent picks the route and category together.

## Current model

`competition_age_categories` already carries `route_id` and `price_bani`; registrations store `category_id` and copy the route and price at registration time. The registration and payment functions resolve everything from `category_id`, so they need no change. The only blocker is the exclusion constraint `competition_age_categories_no_overlap`, which rejected overlapping ages across a whole competition.

## Change

- Migration `00130`: the exclusion constraint compares `competition_id`, `route_id` and the age range, so overlap is rejected only on the same route.
- Organizer form: the overlap check and its message apply per route; the help text says the same age can appear on several routes.
- Registration: the category menu shows `Route · Category · ages · price` when the competition has more than one route; the price summary shows the same title. The `?categorie=` preselection is unchanged.
- Public page: already groups categories under each route.

## Tradeoffs

- No join table: a category stays one row with one route and one price. A shared age range on two routes is two rows. This keeps price snapshots, the podium (grouped by category) and the registration functions untouched.
- A child can still hold one registration per competition; choosing a different route means choosing a different category.
- Existing competitions are unaffected: every existing category keeps its route and range.

## Verification

Unit tests for the overlap rule and for the route-aware menu; constraint behavior checked on a scratch PostgreSQL 16. Applying `00130` to production needs the owner's card.
