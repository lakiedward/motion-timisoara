# Course packages that expire after N days (TT feature #699)

Owner request 2026-11-20 11:21Z: besides „fără expirare” and „lunar”, a course can have packages whose sessions expire after a number of days chosen for the course, for example 45. Owner decisions on cards at 11:24Z:

1. The days run from the payment confirmation: card — the day Stripe confirms it; cash — the day the coach or club confirms the cash.
2. Every package keeps its own expiry. A renewal never moves the sessions left in an older package; attendance takes the package that expires first.
3. N is between 7 and 365.

Already decided and unchanged: unused sessions are lost; the name is „pachet”, never „abonament”; where a course has packages the parent chooses only among them; one validity for all packages of a course (#698).

## What the coach or club sets

„Valabilitatea pachetelor” in the course form (`data-section="course-form-packages"`) gets a third option, „Expiră după un număr de zile” (`DAYS`), and a „Număr de zile” field (`data-section="course-form-package-days"`). The number applies to every package of the course. `course_packages.validity_days` (SMALLINT) is set only for `DAYS`, 7–365 (CHECK). `save_course_packages` takes `validityDays` per package and refuses (22023) any list that mixes validities or `DAYS` packages with different N. The owner confirmed one validity per course on a card at 11:49Z; #698 enforced it only in the client.

## What the parent buys

Course page, checkout and „Cumpără ședințe” show „valabil 45 de zile de la plată”. Under the packages the checkout states the rule and the last day if paid by card today (Bucharest date + N − 1), that cash starts on confirmation and that unused sessions are lost. There is no month to choose; the request is `coursePackageId` only.

The v3 price snapshot of a `DAYS` package has a 14th key, `validDays`, covered by `priceVersion`. `course_quote_matches_offer` checks it against the live `validity_days`, so a quote made before the coach changed N is refused as `PRICE_CHANGED`, and a pending payment for the old N is reported as a started payment to finish.

## Balances

`apply_enrollment_payment_result` creates one `enrollment_monthly_packages` row per confirmed `DAYS` payment with `validity = 'DAYS'`, `valid_from` = Bucharest date of the confirmation and `valid_until` = `valid_from + N − 1` (the confirmation day is day 1). The table keeps its 00150 name; a CHECK keeps monthly rows on whole calendar months and `DAYS` rows between 7 and 365 days. The four attendance paths from 00151 already debit any row by its date range, earliest expiry first, then the never-expiring balance, so they are unchanged. A session dated before the confirmation day is refused as `PACKAGE_NOT_STARTED`; after the last day as `PACKAGE_EXPIRED`. The refusal texts for coach, club and entrance no longer say „lunar”.

Înscrieri shows each running package as „Pachet din 18 noiembrie 2026: 8 rămase din 8, expiră pe 1 ianuarie 2027”, or the last expired one.

## Release order

The app reads the new columns (`course_packages.validity_days`, `enrollment_monthly_packages.validity`). master-- uses the production database, so 00152 must be applied before this PR is merged:

1. #698 (PR #469) merged and its functions deployed.
2. Apply 00152 (owner card). The guard checks the live md5 of the four replaced functions.
3. Deploy `validate-enrollment`, `create-enrollment`, `create-payment-intent`, `create-checkout-session` and `record-attendance` from the merged commit. Until then the old functions refuse `DAYS` packages, so nothing can be sold as `DAYS` early.
4. Merge, verify on master--, publish with the day's publish card.

Rollback: redeploy the functions from before #699, then `verificari/expirare-zile/revenire-00152.sql`, which refuses while any `DAYS` package or payment exists. Tested in an isolated database (`test-revenire-00152.sql`): after it every public function, constraint and column of the two tables is as after 00151.

## Known limits

- A cash payment confirmed days after the session it was meant for does not cover that earlier session (the days start at confirmation, as decided).
- Manual extension of a package by the coach, a reminder before expiry and a report of who has not renewed are later slices, as for monthly packages.

## Checks

`supabase/tests/course-day-packages.sql`, `supabase/functions/course-day-package-contract.test.ts`, unit and component tests in `src/lib/course-packages`, `CheckoutPackagePicker`, `enrollment-display` and `CourseFormPage`.
