# Club coaches page

UI sections #488 (Listă antrenori) and #777 (Coduri invitație) on `/club/coaches`. The owner approved criteria #2028–#2042 on 2026-10-09.

The page is split into `features/club/coaches/`, which also brings the club folder back under 20 files:

- **`ClubCoachList`** gives the coach list distinct loading, error-with-retry and empty states. Coach cards can shrink inside the grid, so long names and emails truncate instead of widening the page on phones. The remove button has the accessible name «Elimină antrenorul <nume>» and a 44 px target. It keeps the browser `confirm()`, the confirmation pattern used elsewhere in the product.
- **`ClubCoachForm`** asks for first and last name, like the admin form from PR #136, and sends them joined as `name` to `create-managed-coach`. Fields and buttons are 44 px tall, and each validation error is linked to its field through `aria-describedby`. The temporary password is copied with the shared copy button.

The admin invite-code section moved to `components/invite-codes/` and takes a data source (query key, load, generate, remove) plus a title and description. Admin passes the `coach_invitation_codes` functions. The club page passes the `club_invitation_codes` functions. The club now gets the same behaviour as admin:

- maximum uses and optional expiry when generating;
- a visible panel with the new code;
- Activ / Folosit / Expirat status, uses and expiry date on each code;
- named 44 px copy and delete buttons, plus a message when deletion fails;
- error-with-retry and empty states.

`generateClubCode` now validates the maximum uses and writes `expires_at`.

Known gap: no active flow redeems `club_invitation_codes`. `redeem-coach-invitation` and the RPC in `00079_atomic_coach_invitation.sql` read only `coach_invitation_codes`. Bug #1146 tracks redemption. The owner decided to ship this UI first and keep #777 from being marked done until the bug is resolved. Ideas left for later are features #435 (email the account details) and #436 (course count on the coach card). Search in the coach list was declined.
