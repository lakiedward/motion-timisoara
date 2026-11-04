# Subscription server rules: access, coach limit, trials (#614, #615, #616)

Spec: `docs/superpowers/specs/2026-11-02-abonamente-antrenori-cluburi.md` (approved 2026-11-02). Plan v41 items 1299–1301. Migrations 00116, 00117 and 00118 were reserved for this work.

## #614 Access rules (00116)

- Visibility is enforced in the SELECT policies of `courses`, `activities`, `camps`, `competitions`, `clubs` and `coach_profiles`, so every public list, the map, the home counts and detail pages follow it. A detail page opened from an old link gets no row and shows the existing "unavailable" state.
- The restriction applies to visitors and parents (the marketplace audience). COACH, CLUB and ADMIN keep reading every organizer, because their panels, camp/competition invitations and admin tools read other organizers' rows. Consequence: a signed-in coach or club still sees expired competitors on the public pages; this is cosmetic and avoids breaking organizer tools.
- A parent keeps reading the offer, club and coach of any enrollment of theirs or their children (any status), so account pages, payments and history stay intact.
- Alternative rejected: extending the client-side `hidden_from_public` filter. It cannot be time-based for `clubs`/`coach_profiles` (column grants block computed fields, see 00113), and it would leave detail pages and hand-written queries open.
- New enrollments: a BEFORE INSERT trigger on `enrollments` refuses an offer without access (23514, DETAIL `SUBSCRIPTION_INACTIVE`). All new-enrollment paths insert there; paying, topping up and attending existing enrollments never insert. `validate-enrollment`, `create-enrollment` and the competition quote check `enrollment_offer_has_access` first and answer 409 `SUBSCRIPTION_INACTIVE` with "Această ofertă nu primește înscrieri momentan."; a participant with an existing unpaid enrollment can still pay it.

## #615 Coach limit (00117)

- BEFORE INSERT trigger on `club_coaches`; locks the club row so parallel additions serialise. No plan chosen (trial) means no limit; the smaller of `plan_code` and `scheduled_plan_code` limits applies.
- Refusal message `COACH_LIMIT_REACHED` is mapped in `_shared/coach-invitation.ts` (redeem/register), the client message table (also used by `join_club_by_invitation`) and `create-managed-coach` (precheck through `club_coach_capacity` before creating the Auth user, plus mapping of a trigger refusal after it).
- `club_coach_capacity(club_id, plan_code)` returns the count, the effective limit and the coaches to remove for a plan, for #618.

## #616 Trials (00118)

- Triggers create a trialing row for each new coach profile and each newly approved club (trial_end NULL before launch, 30 days after). The migration backfills launch-promotion rows for existing coach profiles and approved clubs. Applying 00118 is the production write; its counts go on the owner's card.

## Release order

1. Owner card: apply 00116, 00117, 00118 (with launch_at NULL nothing is enforced), then deploy `validate-enrollment`, `create-enrollment`, `validate-competition-registration`, `create-competition-registration`, `create-managed-coach`, `register-coach`, `redeem-coach-invitation`. Functions go after the migrations because they call the new RPCs.
2. Merge, verify on master--, then #230 exercises the expired states end to end in Stripe TEST.
