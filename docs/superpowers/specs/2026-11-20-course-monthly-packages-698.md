# Monthly course packages (TT feature #698)

Owner decisions of 2026-11-20 (cards at 08:26Z): a monthly package expires at the end of the calendar month; unused sessions are lost; a parent buying mid-month pays the full price and chooses the month; packages replace the per-session price where they exist; the parent-facing name is „pachet” / „pachet lunar”, never „abonament”. No automatic renewal. Manual extension by the coach, a reminder before expiry and a „who has not paid this month” report are later slices.

## What the coach or club sets

Each package in the course form („Pachete”, `data-section="course-form-packages"`) has a validity: „Fără expirare” (`NONE`) or „Lunar – expiră la sfârșitul lunii” (`CALENDAR_MONTH`). The same number of sessions may exist once per validity (the `course_packages_offer_key` constraint from 00148). `save_course_packages` no longer refuses `CALENDAR_MONTH`.

## What the parent buys

At checkout and at „Cumpără ședințe” the parent picks a package. For a monthly package the parent also picks „Luna aceasta” or „Luna următoare” (`data-section="checkout-package-month"`) and sees the whole month („Valabil 1–30 noiembrie 2026”), the last day, the full-price rule and that unused sessions are lost. The order summary repeats „valabil 1–30 noiembrie 2026”.

The month is the calendar month in Europe/Bucharest, in the client, the edge functions and the database. The request sends `packageMonth` (`YYYY-MM`) with `coursePackageId`. The edge functions accept only the current or the next Bucharest month (else 409 `MONTH_CHANGED`, and the client returns to the first step). The v3 price snapshot gets a 14th key, `validMonth`, only for `CALENDAR_MONTH`; `priceVersion` covers it. `NONE` snapshots are byte-for-byte the 00149 shape. `course_quote_matches_offer` checks the month against the database clock, under the course row lock.

Card: a payment for a month that has ended cannot start (`authorizedRonCharge` returns 409 `MONTH_ENDED`) unless Stripe already has it, so a started charge can still be reconciled. Cash: the package exists only after the coach or club confirms the cash payment; the month chosen at checkout stays the same even if the confirmation comes later.

## Balances

- `enrollments.purchased_sessions / remaining_sessions / sessions_used` keep their meaning and hold only sessions that never expire (per-session purchases and `NONE` packages). Enrollments without monthly packages behave exactly as before.
- Every confirmed monthly payment creates one `enrollment_monthly_packages` row (`apply_enrollment_payment_result`): sessions, sessions_used, `valid_from` = first day, `valid_until` = last day of the chosen month. Parents, coaches and clubs read it through the enrollment's own RLS; clients cannot write it.
- A „Prezent” takes one session from the package valid on the session's Bucharest date (`bucharest_date(starts_at)`, so a session at 00:30 on 1 December belongs to December) that expires first, oldest first within the same month; only then from the never-expiring balance. `attendance_accounting.debit_monthly_package_id` remembers the package, so „Absent” or clearing the mark gives the session back to the same package.
- Without a usable session the mark is refused: `NO_REMAINING_SESSIONS` (no sessions, or this month's package is used up), `PACKAGE_NOT_STARTED` (only a later month is bought) or `PACKAGE_EXPIRED` (only earlier months). The coach and club see the reason; the parent sees it at the entrance code.
- One implementation serves all four attendance paths: coach manual and „Toți prezenți”, club manual (00144) and the coach's scan go through `record_attendance_transaction`; the parent's entrance code goes through `entrance_checkin`. `entrance_checkin_options` shows the sessions usable for that session's date.

Înscrieri lists the never-expiring balance and each running monthly package („Pachet lunar noiembrie 2026: 3 rămase din 8, expiră pe 30 noiembrie 2026”), a bought next-month package („începe pe 1 decembrie 2026”), or the last expired one.

## Release order

1. Apply 00150. A guard checks the live md5 of the seven replaced functions first. Production had 0 packages, 0 v3 payments and 0 active course enrollments when this was written.
2. Deploy `validate-enrollment`, `create-enrollment`, `create-payment-intent`, `create-checkout-session` from the merged commit. The old functions refuse monthly packages, so nothing can be sold as monthly before this step.
3. Publish the app.

Rollback: redeploy the four functions from #697, then `verificari/pachete-lunare-698/revenire-00150.sql`, which refuses while monthly packages or monthly payments exist. Tested locally: after it, every public function has the md5 it had before 00150.

## Known limits

- A card payment started at Stripe for a month that then ends stays open; the parent cannot start another renewal until it is cleared. It needs the last day of the month and an unfinished card payment.
- A first-enrollment payment created for a month that ends before it is paid cannot be re-quoted for another month by the parent; renewal can.

## Checks

`supabase/tests/course-monthly-packages.sql` (snapshot shape, month window, confirmation, consumption order, midnight in Bucharest, expired and not-started refusals, undo, the four paths, RLS, constraints), `course-monthly-package-contract.test.ts` (month choice, snapshot, charge refusal), client unit and component tests.
