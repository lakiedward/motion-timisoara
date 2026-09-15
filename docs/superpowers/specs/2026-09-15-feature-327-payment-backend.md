# Feature 327: atomic payment enrollment and recovery

## Contract

The existing create-enrollment HTTP request and response remain compatible. The
handler still computes and checks the accepted per-child price versions, then
calls `save_enrollment_batch`. Only `service_role` can execute this invoker RPC.
No client receives permission to supply trusted prices or another parent identity.

The transaction locks the offer row before checking capacity and saving any
enrollment. It rereads the parent role and child ownership, locks existing
enrollments before their payments, and inserts or reuses all children together.
Any error rolls back the complete batch. A simultaneous request for the same
child reuses a compatible pending payment; a different child cannot consume a
seat already claimed by the first transaction.

New, unaccepted quotes are compared with the locked offer's current source price,
currency and conversion rate. Existing accepted snapshots remain immutable even
when the organizer edits that offer. An ambiguous historical enrollment/payment
set is rejected for manual investigation without deleting or merging records.
An existing paid card enrollment can be returned only with its exact accepted
snapshot and bound gateway payment; it is never changed or credited again.

Cash remains pending until the existing coach confirmation path completes it.
Unpaid cash can still become card with its same accepted snapshot. Cash broadcasts
run after commit and only for newly created enrollments, so notification failure
cannot make a committed enrollment appear to have rolled back.

`create-payment-intent` preserves its existing `clientSecret` and
`alreadySucceeded` response fields. It additionally returns the saved RON amount,
`currency: "RON"`, and `testMode` derived from Stripe's `livemode`. Existing
`processing` or `requires_capture` intents return `alreadyProcessing: true`.
No replacement intent or charge is created for those states. Canceled or unknown
enrollment states cannot initiate or resume a charge. Fulfillment remains solely
in the existing transactional webhook/coach completion path.

## Local verification

`pwsh -NoProfile -File supabase/tests/run-atomic-enrollment-creation.ps1` uses a
network-isolated PostgreSQL container. Assertions cover execution grants, ownership,
RON/EUR snapshots, source changes, cash, active replay, malformed or ambiguous
records, rollback on the second child's payment failure, capacity and one-time
session crediting. Separate connections exercise duplicate creation, the final
available seat, and payment completion racing a retry. The container is removed
after the run.

The Deno enrollment contract suite exercises the HTTP validation and RPC boundary.
Payment intent/charge tests cover stable gateway identities, frozen routing and
amounts, processing, actual gateway mode and canceled-enrollment rejection.
These are backend contract proofs; native PaymentSheet, Google Pay and 3DS require
the separately recorded real-device checks.

Migration application, Edge Function deployment and production/native verification
are separate delivery steps. No remote writes were performed while implementing
this backend portion.

## Card-only Stripe method selection

The native test surfaced dashboard-enabled Klarna and Link on intents created
without an explicit method list. New requests now freeze
`payment_method_types: ["card"]` and omit automatic method selection. The endpoint
and shared preparer both enforce this. Card-backed Google Pay remains available;
native Link presentation is controlled separately in the Android sheet.

Existing frozen creation requests must still be replayed unchanged for Stripe
idempotency. Once that same intent is bound, or when retrieving a previously bound
intent, a legacy TEST intent may be narrowed with an update containing only
`payment_method_types`. This applies only when it is awaiting a payment method and
none is attached, or the expanded attached method is a card whose prior attempt
failed. Live, actionable and unknown/non-card attached-method legacy intents are rejected
without modification; processing and completed intents retain their inspection
responses. Failed updates never cause replacement or repricing. The returned ID,
secret, amount, currency and enrollment/payment metadata are checked before use.
An updated response that has progressed to processing/completion is inspected
without asking the client to confirm again.

This uses Stripe's documented
[PaymentIntent update operation](https://docs.stripe.com/api/payment_intents/update)
and the `payment_method_types` field in its
[version 14 SDK](https://github.com/stripe/stripe-node/blob/v14.25.0/types/PaymentIntentsResource.d.ts).
Stripe enabled automatic dashboard methods by default in
[API version 2023-08-16](https://docs.stripe.com/changelog/2023-08-16/automatic-payment-methods).
The update operation does not itself confirm the payment. Live Stripe TEST
verification of the changed endpoint remains a separate deployment check.
