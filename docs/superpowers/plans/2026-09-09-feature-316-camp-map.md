# Feature 316: public camp locations

The owner approved finishing the public map integration on 2026-09-09. Camp locations already exist in the schema and authoring forms. This change uses that association without migrations or another location picker.

## Behavior

Public camp responses include the associated location, retaining the original location instructions when the relation is unavailable. List and detail views show the associated name and link to the existing `/harta?location=<id>` contract. Camp cards retain their primary detail link with a separate map link and no nested anchors.

The map fetches active camps using the existing reader-local end-of-day filter. It keeps one marker per grouped place and the existing place naming rules. Places with camps use the owner-selected Lucide Tent symbol and highlight token. Their popup retains courses and activities and adds camp detail links with dates. The owner requested filters for every offer type: All, Courses, Activities and Camps. Each filter selects places with that offer type while the shared popup retains all offers at the location. Unavailable relations do not produce camp offers; empty and failed queries stay distinct.

The static marker SVG is generated from the installed lucide-react 1.18.0 Tent icon and retains its ISC license. Generating it once avoids including React's server renderer in the browser bundle.

## Verification and delivery

Extend existing API and page tests for relation/fallback, grouped offers, filtering and query recovery. Run typecheck, lint, unit tests and production build. Verify live read-only data plus explicitly simulated camp-location associations at 1440x900, 768x1024 and 375x812, including keyboard, popup, failure/retry and navigation. No real camp records are changed for testing.

The user reviews the resulting UI before merge. Required tracker human gates remain human-owned. Commit and open a PR, require a clean Bugbot review and required CI, then merge after the human visual gate. Record actual evidence and mark the feature complete only after required delivery checks.
