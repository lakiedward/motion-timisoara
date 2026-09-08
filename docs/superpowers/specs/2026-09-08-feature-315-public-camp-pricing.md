# Feature #315: public camp age pricing

This records the PR #68 implementation and pre-rollout observations. The subsequent owner-approved migration, function deployments and live integration evidence are recorded in [the live verification report](2026-09-08-feature-315-live-verification.md).

Continue the merged enrollment checkpoint (PR #67) with the public camp presentation. Preserve the existing price card, navigation, organizer/gallery content and availability rules.

For single-price camps, retain the fixed price and itemized cost explanation. For age pricing, display every inclusive age interval and its amount without presenting `camps.price` as the payable total. Existing item names/descriptions still explain what is included, but their fixed cost breakdown cannot represent every age tariff and must not be advertised as the final price. List cards indicate age-based pricing instead of an obsolete single amount.

Authenticated parents see their own children's names beside the matching categories. Match completed years on the camp start date using calendar components, including birthdays and leap-day cases. Multiple children can highlight the same row or different rows; a child outside every interval gets an explicit message. This display is informational: enrollment still obtains authoritative server quotes and verifies price versions.

Only parents request child data, using a query key scoped to their user ID and filtering ownership. Loading, error/retry and no-child states are distinct and never hide the public tariffs. Anonymous and other-role visitors see the public categories without a child-data request. Reuse the existing typed age-price reader; do not add browser calls to the child-price SECURITY DEFINER RPC.

Live inspection on September 8 confirms RLS on camps, camp_age_prices and children. Camp and category SELECT policies allow anon/authenticated; child SELECT also serves coach/club/admin paths, so the personalization must stay explicitly parent-scoped. Migration 00041 is still unapplied remotely; its RPC restriction and Edge Function deployment remain a separate authorized rollout.

Extract the card under `features/public/camp-pricing/` to keep the public folder within its file-count limit. Use existing semantic tokens, list spacing, Button, Badge and Skeleton primitives. Preserve UI Coverage stable key `motion-react:page:/tabere/:slug:section:detalii-si-inscriere`; the feature supersedes the old single-price-only criterion, but the agent does not rewrite accepted criteria or human verdicts.

Verification covers API read/error behavior, calendar and interval boundaries, single/age mode rendering, identity-scoped personalization, missing categories, public list copy and existing availability/navigation. Run the full app checks and responsive browser simulations at 1440x900, 768x1024 and 375x812, including dark theme and navigation into the existing checkout. Record simulation evidence separately from live integration. Obtain a clean Bugbot review before merge. Full #315 completion still requires the authorized live rollout and its evidence.

## Local verification and live readiness

App typecheck, lint, 587 tests across 60 files and production build pass. Existing Capacitor import and large-chunk warnings remain. UI conventions were regenerated; the measured drift ceilings were not changed. Browser evidence is produced by the existing isolated pricing suite, extended with public-page scenarios.

Live read-only verification found three camps, all in single-price mode, with no age categories. The deployed validate-enrollment and create-enrollment functions are still version 2; neither contains the child-price RPC or price-version contract. Migration 00041 is unapplied. Therefore simulated category rendering and checkout evidence does not establish live integration.

A complete rollout requires explicitly authorized migration 00041, deployment of both enrollment functions with their shared modules and existing JWT checks, appropriate approved frontend delivery, and consented test fixtures covering in-range/out-of-range children. Preserve existing payment amounts; no real charge is needed for the UI acceptance. No live records, migrations or function deployments are performed by this public-page implementation.

## Browser evidence

The isolated Chromium suite passes 23 scenarios: the 11 existing checkout journeys plus 12 public-page scenarios. Public prices and parent category highlights are checked at 1440x900, 768x1024 and 375x812, with an additional dark-theme mobile capture. The two simulated tariffs are 600 and 800 RON; the obsolete 990 RON camp amount is absent in age mode. Single mode retains its fixed amount and cost explanation. Child loading errors preserve public prices and support retry; anonymous/coach views issue no child-data requests. Shared categories, missing categories, no children and the public list label are covered.

On mobile, age and amount stack on the left so the existing floating account control does not obscure the tariff. On desktop/tablet the amount remains aligned to the right. Relevant captures are `SIMULATED-public-age-prices-parent-highlight.png` and `SIMULATED-public-age-prices-dark-theme.png`, with network/console evidence in `SIMULATED-network-console.json`. All successful scenarios have empty unexpected-console, external-request and unexpected-API arrays; injected 409/503 errors are recorded separately. API/auth/Stripe responses are simulated and no real data is created.

Personalization uses the user-scoped `['children', user.id]` query key so existing child mutation invalidations refresh category labels immediately. The regression test invalidates the shared child prefix and observes the new names.

The isolated SQL runner uses the official `supabase/postgres:17.6.1.063` image from Docker Hub, pinned to the same manifest digest as the original ECR image. ECR rejected both CI attempts with `toomanyrequests` before SQL execution. The registry change preserves the database image and all pricing assertions.
