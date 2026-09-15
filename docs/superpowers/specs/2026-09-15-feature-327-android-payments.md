# Feature 327: Android enrollment payments

## Accepted scope

The owner approved Android card payments with 3D Secure and Google Pay, verified
on Galaxy A55 using Stripe TEST. Cash and the accepted #149 EUR/RON pricing
contract remain unchanged. Apple Pay, iOS verification, live charges and frontend
or store publication are separate work. The approved daily plan is 113/v16.

## Current gaps

Checkout currently confirms one PaymentIntent per child through web CardElement.
It loses the created enrollment IDs after leaving the page. Retrying a selection
after one child is paid can reject the whole selection. The enrollments page has
no payment recovery action, and completion depends on an ephemeral Realtime event.
The initial enrollment/payment inserts are separate, without a transaction or a
natural-key concurrency guard. Live inspection found no existing duplicate active
or pending enrollments or duplicate payment rows.

## Design

Use an app-local Capacitor Android bridge around the pinned official Stripe SDK
PaymentSheet. Existing web Elements remain the web adapter. Community Stripe
8.2.1 and the Capgo fork 8.0.4 declare React 17/18 and Stripe.js 8 peer ranges;
the application uses React 19 and Stripe.js 9. Avoid forced dependency resolution
or downgrading the working web checkout for an Android-only integration.

PaymentSheet presents card and Google Pay using the backend-created PaymentIntent.
Each child keeps its existing independent payment and immutable RON amount. Explain
the separate confirmations before opening the sheets. Cancellation stops the batch.
No card details, client secrets or wallet tokens are persisted by application code.
Google Pay uses its TEST environment only in this stage. The application presents
clear fallback copy when the wallet is unavailable; card payment remains available.

Extract shared payment orchestration which takes existing enrollment IDs. Read
their owner-scoped server state before confirmation and reconcile after native or
web completion. Webhooks remain the only fulfillment authority. Bounded polling
and refresh on application resume cover missed Realtime events. Never automatically
charge on mount, background resume, a deep link or an SDK recovery event.

Add a payment action to pending/failed card enrollments. It shows the saved amount
and snapshot, uses the same PaymentIntent and bypasses enrollment creation, current
offer pricing and package selection. Paid or processing payments are inspected,
not replaced. An interrupted batch remains discoverable in the enrollments list.

Replace the initial handler's persistence with a service-only atomic batch RPC.
Serialize per offer, recheck ownership, active/pending rows and remaining capacity,
and save enrollment plus payment together. Concurrent attempts reuse a compatible
pending snapshot or fail explicitly. Ambiguous historical rows are never cleaned
automatically. Keep legacy web request shapes and cash eligibility intact.

## Verification and delivery

- Isolated SQL: ownership, private execution grants, concurrency, atomic rollback,
  capacity, frozen quote reuse and no duplicate sessions/payments.
- Unit and contract tests: cancel/failure/processing, partial success, same-ID retry,
  unavailable wallet, missed webhook event, and rejected foreign enrollment IDs.
- Application typecheck, lint, Vitest and build; Android compilation and unit tests.
- Chrome: real components at 1440x900, 768x1024 and 375x812, including error/retry
  and pending states. Label any isolated harness as simulated data.
- Galaxy A55: 3DS success/refusal/cancel, Google Pay TEST success/cancel/unavailable,
  leaving/returning and cold restart, multi-child partial success, saved RON amount
  and single backend fulfillment. Use only authorized temporary audit fixtures and
  remove this task's fixtures after recording evidence.
- Present the final UI for human acceptance, review the final diff, fix findings,
  merge after required checks and record Android-only completion in Team Tracker.
  Human-owned tracker acceptance and milestone fields remain human-owned.

## Primary references

- [Stripe Android Google Pay](https://docs.stripe.com/google-pay?platform=android)
- [Stripe Android mobile payments](https://docs.stripe.com/payments/mobile/accept-payment?platform=android&type=payment)
- [Stripe SDK 22.8.1](https://github.com/stripe/stripe-android/releases/tag/v22.8.1)
- [Capacitor Stripe PaymentSheet contract](https://docs.rdlabo.dev/projects/capacitor-stripe/docs/payment-sheet)

Evidence and final SDK/build decisions will be recorded after implementation.
