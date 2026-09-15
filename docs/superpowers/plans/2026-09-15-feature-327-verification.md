# Feature 327 verification record

Verified on 2026-09-15 for the approved Android Stripe TEST stage in plan 113/v16.
Apple Pay, iOS payment verification, real charges and frontend/store publication
remain outside this stage. Backend migration and Edge Functions were deployed.

## Automated checks

| Check | Final result | Evidence boundary |
| --- | --- | --- |
| Application TypeScript | `npm run typecheck` passed | Application TypeScript project. |
| Application lint | `npm run lint` passed without warnings | Includes the ignored local harness. |
| Complete application suite | 98 files, 1,049 tests passed | API/native boundaries are mocked. |
| Production build | `npm run build` passed | Existing bundle-size and dynamic-import warnings remain. |
| Android | 22 unit tests passed; debug APK assembled and installed | Official Stripe SDK 22.8.1 and Wallet 19.4.0. |
| Backend contracts | 83 Deno tests passed | 52 enrollment, 27 intent and 4 payment-charge tests. |
| Atomic enrollment SQL | Isolated SQL suite and three concurrent-connection cases passed | Duplicate retries, final-seat capacity and payment completion racing a retry. |

The generated UI-conventions document was regenerated before the final complete
application run. The repository has no implemented `check:rules`; no such result
is claimed. CI now runs the atomic enrollment SQL runner and all three payment
contract files in its `enrollment-payments` job.

Payment regressions cover partial success followed by cancellation/refusal, reuse
of the same enrollment IDs, processing/succeeded intent inspection, Android rejection
of live or unspecified modes, owner-scoped failures, cancellation on navigation or
account change, bounded backend reconciliation, saved RON amounts/EUR snapshots,
wallet fallback and explicit recovery without charging on mount or refresh.

## Remote configuration

Product Supabase: `ehdzafadshbaaghzdzdo`.

- Migration `00060_atomic_enrollment_creation.sql` applied as `20260915142234`
  (`atomic_enrollment_creation`). Generated types were refreshed from that schema.
- `create-enrollment` v8 ACTIVE, JWT verification enabled; source SHA-256
  `bd4f4d51549e8e0f7a0cb023fccf93952479e57ea1ccc0fd1745278953b2638a`.
- `create-payment-intent` v8 ACTIVE, JWT verification enabled; source SHA-256
  `8796e722e37aca415d7cfeb81e7bd5b20077bbed8598645a6046eb99120e484d`.
- New intents allow card, including Google Pay. Eligible unconfirmed legacy TEST
  intents are normalized on their existing ID; live, non-card and in-flight
  intents are not silently changed. No amount, quote or confirmation is replaced.
- Google Pay was enabled in the existing Stripe TEST payment-method configuration.
  No LIVE setting was changed. Native Link is hidden; new card-only intents exclude
  unrelated payment methods from the Android sheet.
- Existing Stripe webhook fulfillment was exercised by actual TEST failure and
  success transitions. No new webhook or fulfillment authority was introduced.

## Chrome and human acceptance

`http://127.0.0.1:3027/?scenario=full` renders the real payment and enrollment
components with the visible label `Date simulate · #327`. Its API, Stripe and
native operations are simulated; the harness is excluded from Git.

Verified at 375x812, 768x1024 and 1440x900: card/Google Pay explanations, separate
payments for multiple children, saved amount/snapshot, paid/pending rows and explicit
`Reia plata`. Content remains readable without horizontal overflow. Opening a saved
payment shows its amount and waits for an explicit payment action.

`?scenario=error` displayed retry and recovered after `Reîncearcă`.
`?scenario=unavailable` displayed the card fallback when Google Pay was unavailable.
The final desktop harness console contained no errors. Screenshots and accessibility
observations were inspected in the task session; simulated data is not native proof.

The owner approved the interface and merge after verification on 2026-09-15.
Human-owned Team Tracker acceptance and milestone fields were not written.

The real web checkout at `http://127.0.0.1:3017` created two consented audit
enrollments against the product backend. Submitting an empty web card field left
the saved rows recoverable. This established the cross-runtime recovery scenario;
the initial enrollment batch was submitted on web, not on Android.

## Galaxy A55: physical Stripe TEST evidence

Device: Galaxy A55, Android 16. A debug APK containing the final frontend/native
changes was installed. The UI showed TEST mode; Google's test wallet explicitly
stated that the payment method would not be charged.

Each fictional child selected five course sessions at EUR 12.34/session and a
saved rate of 5.123456 RON/EUR: 31,612 bani each, 63,224 bani total. Android
rendered this quote before confirmation, and recovery retained the same snapshot.

| Case | Observed result |
| --- | --- |
| Card 3DS refusal | Stripe test challenge `FAIL` retained Ana's pending enrollment, FAILED payment, same intent, saved 31,612 bani and zero sessions. |
| Return after refusal | Closing the SDK returned to the saved enrollment panel with an explicit retry action. |
| Card 3DS success | Reopened the same payment and completed the test challenge. Webhook produced ACTIVE enrollment, SUCCEEDED payment and exactly 5 purchased/remaining sessions. |
| Multi-child partial success | Ana remained paid with 5 sessions while Bogdan remained pending with zero. No reconfirmation of Ana's payment occurred. |
| Google Pay presentation | Native sheet showed Google Pay and card, with no Link/Klarna. Google TEST wallet showed the 316.12 RON amount and test Visa ending 4242. |
| Google Pay cancellation | Closing the wallet and sheet returned to the saved panel. Bogdan remained pending; Ana stayed at 5 sessions. |
| Cold restart before retry | Killed and reopened Motion, then opened account enrollments. Paid/pending state remained correct and no payment started automatically. |
| Google Pay success | Explicitly resumed Bogdan and confirmed Google TEST wallet. Returned to `Plata este confirmată. Nu mai trebuie să plătești.` |
| Background return | Sent Motion to Home and reopened it after success. Both rows remained paid with 5 sessions each and no new payment action. |

Final backend query returned exactly two enrollments and two payments, both ACTIVE /
SUCCEEDED, each with purchased=5, remaining=5, used=0 and amount=31,612 RON bani.
The intent IDs were unchanged across retries:

- Ana, 3DS: `pi_3UFxPx0lj0kEqgLX0RIgrBr3`.
- Bogdan, Google Pay: `pi_3UFxdC0lj0kEqgLX0Jp1wxVD`.

Stripe TEST Dashboard independently showed Bogdan's same intent as Succeeded for
316.12 RON, with successful confirmation at 17:50 on 2026-09-15 and matching
enrollment/payment metadata. Native wallet interaction establishes the Google Pay
path; the database confirms one-time fulfillment.

Limits: Google Pay was available on this device. Its unavailable fallback was
verified in browser/unit tests, not forced on the owner's phone. Cash and other
enrollment kinds were covered by shared SQL/Deno contracts, not additional physical
payments in this run. There was no force-kill while a provider confirmation was
in flight, and no real-money or iOS payment claim is made.

## Cleanup

After recording fulfillment evidence, a guarded transaction removed only this
task's two fictional children, two enrollments/payments, one course, one activity
and one camp. Foreign-key cascades removed their payment-intent request records.
Post-cleanup counts were zero for all seven categories. The existing owner and
audit coach profiles were preserved. Stripe retains its TEST transaction history;
no real charge or refund occurred. No public club push audience was attached to
these offers.

## Review and delivery boundary

Independent backend review examined atomic persistence, grants, lock ordering,
rollback, ownership/capacity checks, cash/EUR compatibility, paid replay and safe
same-ID TEST normalization; no actionable findings remained. Independent frontend
review found a stale success callback after navigation/account change; cancellation
and result guards were added and the regression tests passed in the final suite.
Final Android review and compilation covered lifecycle handling and SDK-aligned
Google Pay readiness. The final diff also received local source/convention review.

Changed/new authored files stay below 600 lines. The largest is the 561-line
enrollment contract test; CheckoutWizard has 543 lines. New payment folders and
checkout remain below 20 direct files. Existing direct-file counts in `src/api`
(32) and `src/lib` (26) did not grow. No new authored TS/TSX/JS/MJS/CSS comments
were added. The CLAUDE/AGENTS mirror was updated together.

This record covers the reviewed implementation and verified backend/device stage.
The PR records its final reviewed revision, CI results and actual merge. No frontend
or store deployment is part of this delivery.
