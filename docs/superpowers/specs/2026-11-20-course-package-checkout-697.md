# Course packages at checkout (TT feature #697)

Owner decisions of 2026-11-20 (cards at 08:26Z): where a course has packages they replace the per-session price; courses without packages work as before; parents see „pachet”, never „abonament”; validity is „fără expirare” or the calendar month. Owner comment at 09:40Z: the coach or club must be able to stop parents from buying another number of sessions. Defining packages is that option: on a course with packages the parent can buy only one of them, at first enrollment and at renewal („Cumpără ședințe”), and the server refuses anything else.

This slice sells `NONE` packages. `CALENDAR_MONTH` packages stay hidden in the client and refused by the server until #698 adds the expiry and consumption order.

## Price snapshot v3

One `payments` row is one purchased package. Its immutable `pricing_snapshot` gets `schemaVersion: 3` with exactly these keys: `kind` (`COURSE`), `entityId`, `childId`, `packageId`, `validity` (`NONE`), `sourcePackageAmount` (package total in the course currency), `sourceCurrency`, `quantity` (package sessions), `eurRonRateMicros`, `amount` (RON, converted once from the total), `currency` (`RON`), `priceVersion`.

The total has its own key instead of `sourceUnitAmount`, so no existing reader multiplies it by the session count. `apply_enrollment_payment_result` already adds `quantity` on confirmation, so the balance logic is unchanged. #698 can add the validity window to the same record.

## Server authority

Migration `00149_course_package_checkout`:

- `valid_course_package_price_snapshot` validates the v3 shape and arithmetic; `valid_enrollment_price_snapshot` (the `payments` CHECK) dispatches v3 to it.
- `course_quote_matches_offer(course, snapshot)`: a course with packages accepts only a v3 snapshot of one of its current `NONE` packages (id, sessions, price, validity and the course currency re-read from `course_packages`); a course without packages accepts only the v1 per-session snapshot.
- `save_enrollment_batch` and `start_course_renewal` use it in place of their per-session check. They lock the course row, and `save_course_packages` locks it too, so packages cannot change between the check and the payment insert.
- A guard refuses to run unless the live `save_enrollment_batch` matches 00068 and `start_course_renewal` matches 00147.

Edge functions resolve the choice from `course_packages` (`_shared/course-package.ts`). The request sends `coursePackageId` in place of `sessionPackageSize`. A missing, unknown or changed package returns 409 `PACKAGE_CHANGED`, and the client then reloads the offer. A monthly package returns 409. A pending payment for another package tells the parent to finish it from „Înscrieri”.

## UI

- Course page: the enroll card shows „de la X / ședință” and the package list (the #696 flag is removed).
- Checkout and renewal: on a package course the picker is a radio list of package cards (`data-section="checkout-course-packages"`) with total, price per session and „fără expirare”. There is no „Altul” and no free number. Courses without packages keep the session chips.
- Course form: the explanation says the parent can buy only the packages, at enrollment and renewal.

## Release order

Apply 00147, then 00149, then deploy `validate-enrollment` and `create-enrollment`, then publish the app. The published client sends a session count, so on a course with packages it gets „Acest curs se plătește pe pachete” until the new app is published. Rollback: `verificari/checkout-pachet-697/revenire-00149.sql`, which refuses while v3 payments exist.

## Checks

`supabase/tests/course-package-checkout.sql` (validator, grants, refusals, cash and card purchase, renewal, repricing, removal), `course-package-contract.test.ts` (edge choice and snapshots), wizard and picker component tests.
