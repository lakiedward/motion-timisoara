# Feature #315: authorized live integration

On 2026-09-08, the owner approved the proposed migration and temporary test data after the merged server/checkout and public UI changes in PRs #67 and #68. This verification used frontend commit `1212291d2186fa8f0cb34bc4795d7f1170e5d3d6` locally at `http://127.0.0.1:3017`, connected to the live product Supabase project `ehdzafadshbaaghzdzdo`. It does not establish a deployed frontend or a native release.

## Deployment

Migration `00041_camp_child_price_server_only.sql` was applied with remote version `20260908143741`, name `camp_child_price_server_only`. Effective EXECUTE access to `pret_tabara_pentru_copil(uuid,uuid)` is false for `anon` and `authenticated`, true for `service_role`. Actual client HTTP calls returned 401 and 403 respectively with PostgreSQL code `42501`.

Both `validate-enrollment` and `create-enrollment` were deployed at version 3, ACTIVE, with `verify_jwt=true`. Each deployed entrypoint, handler and three shared files matched the merged source after newline normalization. No other Edge Function was redeployed.

## Browser proof with live data

Two temporary parent identities, six children, two camps and two age-price rows were created for this authorized test. Normal password login through the application succeeded. The age-priced camp started on 2026-10-01; a child born on 2018-10-01 matched the 6–9 interval at 600 RON, and a child born on 2013-10-02 matched the inclusive 10–12 interval at 800 RON. A 16-year-old child had no category.

The public page displayed both tariffs and parent highlights at 375×812, 768×1024 and 1440×900, without horizontal overflow or the obsolete 990 RON single amount. The mobile checkout disabled the unmatched child, displayed 600 + 800 = 1,400 RON, accepted the terms for these synthetic fixtures, and saved a cash enrollment through the deployed endpoint. The enrollment page displayed both pending amounts. There were 39 observed Supabase HTTP responses, no page/console errors and no `create-payment-intent` request. This was a real authenticated backend journey with temporary fixtures; responses were not simulated.

The local Stripe configuration includes the billing step, so the harness supplied synthetic billing fields before choosing cash. The cash submission did not send those billing fields. Stripe.js emitted its localhost HTTP warning; card payment and HTTPS production behavior were not exercised. No actual payment, refund, staff message or email was initiated.

## API and persistence checks

Thirteen live API checks passed:

- Anonymous and authenticated client RPC calls were denied.
- Foreign-child validation returned ineligible with a masked name and no amount; creation returned 403.
- Missing and out-of-range children were ineligible; out-of-range creation returned 409.
- Single-mode validation retained 50,000 bani.
- Changing the temporary tariff from 60,000 to 65,000 bani rejected the old price version with `PRICE_CHANGED`; accepting the fresh version created only a pending payment at 65,000 bani.
- Synthetic processed and refunded payment states could not be overwritten after another tariff change to 70,000 bani.
- A synthetic gateway-associated pending payment retained its 55,000-bani amount. Its marker was deliberately not a real Stripe intent; no gateway call was made.

Database inspection confirmed the original cash amounts of 60,000/80,000 bani, the preserved processed/refunded fixture amount of 65,000 bani and the reserved amount of 55,000 bani. The rejected children had zero enrollments. These processed/refunded statuses were test fixtures, not real financial transactions.

## Cleanup and evidence

Both temporary auth users and their profiles, children, enrollments and payments were deleted through the verified cascades; both temporary camps and age categories were removed. Follow-up counts were zero for every fixture group, including auth identities, sessions and refresh tokens. The payment table had zero rows before and after the test, and its aggregate fingerprint was unchanged. Local password and authenticated session files were deleted. Existing camp data was not modified.

Evidence is retained outside the public repository under `C:/Users/lakie/.codex/visualizations/2026/09/08/01a080d1-5806-76e3-90be-5beef3d1568d/feature-315-live/`:

- `LIVE-public-375.png`, `LIVE-public-768.png`, `LIVE-public-1440.png`
- `LIVE-checkout-details-375.png`, `LIVE-checkout-summary-375.png`, `LIVE-enrollments-375.png`
- `LIVE-browser-evidence.json`, `LIVE-api-evidence.json`

The backend rollout and tested local-frontend/live-backend integration are complete. Human UI acceptance, an approved frontend release and relevant native verification remain separate gates. Feature #315 stays open until those required gates are satisfied; no human verdict or production marker was written by the agent.

Post-rollout repository checks also passed: application typecheck, lint, 587 tests across 60 files and production build. Existing Capacitor mixed-import and large-chunk build warnings remain. The documentation mirror is byte-identical and `git diff --check` passes. This delivery record changes Markdown only; the deployed code had already passed Bugbot and CI before PR #68 was merged.
