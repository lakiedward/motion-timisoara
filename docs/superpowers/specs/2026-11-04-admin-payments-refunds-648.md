# Admin payment history and refunds (#648)

Request (owner, 2026-11-04): the admin needs a full refunds section and must be able to see who paid, how and when, for any moment in time.

## Current state

- `payments` holds every enrollment payment (course, camp, activity), card or cash. Card payments are Stripe destination charges whose application fee is the exact Stripe fee (#636); `stripe_fee_amount`, `platform_fee_amount`, `coach_payout_amount` and `stripe_destination_account` are filled by the fee settlement.
- `gateway_txn_id` is a `pi_` id for single PaymentIntents and a `cs_` id for Checkout sessions, which may cover several payment rows in one charge.
- Coach and club subscription invoices exist only in Stripe. The database stores the subscription state, not its payments.
- Nothing refunds a payment. `stripe-webhook` ignores refund events. The admin portal only has the shared cash confirmation page at `/admin/payments`.

## Scope

1. One admin list of every payment: enrollment payments (card and cash) and subscription invoices, newest first, filtered by a date range, status, kind and method, with search on payer, participant, offer and Stripe reference.
2. Each entry shows the payer (name and email), participant, offer or plan, method (card brand and last four digits, or cash), amount, date and time, receiving account, status, amount refunded and the refund history.
3. Totals for the selected range: collected, refunded, net and cash awaiting confirmation.
4. Full or partial refunds with a mandatory reason, only from an ADMIN session whose live profile role is ADMIN.
5. Card refunds go through Stripe with an idempotency key. For destination charges the transfer is reversed (`reverse_transfer: true`) and the application fee is kept (`refund_application_fee: false`): the parent gets the refunded amount, the coach or club returns that amount, and the Stripe fee, which Stripe does not return, stays with the coach or club. Owner decision 2026-11-04 11:09Z (card "Cine suportă comisionul Stripe când rambursăm o înscriere?", option "Antrenorul sau clubul"). The rule is stated in the admin refund panel, on the coach/club online payments card and, through the terms thread, in the Terms.
6. Refunds created in the Stripe dashboard are recorded from `charge.refunded` and `charge.refund.updated` webhook events.
7. Cash refunds are records only: the admin states that the money was returned by hand.
8. A full refund may optionally cancel the enrollment.

## Data model (migration 00119)

- `payments`: `amount_refunded` (bani, 0 to `amount`), `card_brand`, `card_last4`. A partial refund keeps the status `SUCCEEDED`; a full refund sets `REFUNDED`. `PARTIAL` keeps its historical meaning and is not reused, so code that treats `SUCCEEDED` as paid keeps counting partially refunded payments.
- `subscription_invoices`: one row per Stripe invoice of a subscription (`in_` id unique), written by `stripe-subscription-webhook` on `invoice.paid` and `invoice.payment_failed`.
- `payment_refunds`: one row per refund, linked to a payment or a subscription invoice, with amount, reason, status (`pending`, `succeeded`, `failed`, `canceled`, `requires_action`), Stripe refund id, admin, whether the enrollment was cancelled and the fee policy used.
- RLS: ADMIN reads `subscription_invoices` and `payment_refunds`; all writes go through service-role functions.
- `begin_payment_refund` locks the payment or invoice row and refuses a refund above the amount still refundable, counting pending refunds, so two admins cannot over-refund. `settle_payment_refund` records the Stripe outcome and recomputes the refunded total. `record_stripe_refund` upserts a refund seen in a webhook.
- `get_admin_payments(from, to)` returns the unified list with refunds as JSON, for ADMIN only.

## Design

Owner choice 2026-11-04 11:09Z: direction A (one list grouped by day with totals, details and refund in a side panel) plus the date range and CSV export from direction B. The page replaces the admin cash page at `/admin/payments` (navigation label „Plăți”); pending cash payments are still confirmed from the panel.

## Tradeoffs

- Storing invoices instead of reading Stripe on every page load keeps search and date filters in SQL and keeps history readable if Stripe is unreachable. The cost is one more webhook write and a one-time backfill of older invoices.
- Refund rows keep payer and description snapshots and use `ON DELETE SET NULL`, so accounting history survives account deletion.

## Out of scope

- Free subscription extensions (#620).
- Invoicing and credit notes (#622/#623).
- Live Stripe: all refund tests run in Stripe TEST until #232.
