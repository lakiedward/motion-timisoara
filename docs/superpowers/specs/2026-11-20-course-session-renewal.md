# Course session renewal (Team Tracker feature #695)

## Goal

A parent with an ACTIVE course enrollment can buy more sessions for the same child and course, by card (Stripe) or cash confirmed by the coach or club. The confirmed payment adds the bought sessions to `purchased_sessions` and `remaining_sessions`. The price is the course's current per-session price. Parent-facing copy says "pachet", never "abonament" (that word stays for the coach/club platform subscription).

## Data model

- One enrollment keeps many payments. Each payment carries its own pricing snapshot, whose `quantity` is the number of sessions it buys.
- At most one open payment (PENDING or FAILED) per enrollment, enforced by the partial unique index `payments_one_open_per_enrollment` (migration 00147).
- The current payment of an enrollment is the open one, otherwise the newest by `created_at`. Edge functions use `_shared/payment-current.ts`; the app uses `currentFirst()` in `src/api/payments/enrollments.ts`.
- `apply_enrollment_payment_result` is unchanged: on SUCCEEDED it already adds the snapshot quantity to the enrollment, so a second, third... payment works as the first one did.
- `start_course_renewal` (service_role only, called by `create-enrollment`) checks parent ownership, ACTIVE course enrollment, active course, offer access and the price snapshot; it creates the open payment or resumes the existing one, and records the checkout acceptance.

## Rules and limits

- An open renewal can be resumed or switched between card and cash only while no Stripe session exists; its amount and package cannot change, because accepted pricing snapshots are immutable (`guard_enrollment_price_snapshot`). A different package needs the open payment to be confirmed or cancelled first.
- A failed card renewal stays the open payment and can only be resumed.
- Refunds do not remove sessions (existing behaviour). Free courses (price 0) have nothing to renew.

## Building on it

- #697 (coach-defined packages with a price): the quote replaces the per-session price with the package price and records the package id in the snapshot; `start_course_renewal` and the open-payment rule stay.
- #698 (monthly packages with expiry, consumed from the one that expires first): sessions move from enrollment counters to per-payment balances with an expiry date; each SUCCEEDED payment already identifies one purchase, so it becomes the balance row's source without rewriting renewal.
