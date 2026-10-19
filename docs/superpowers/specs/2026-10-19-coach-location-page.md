# Parent coach-location page ("Unde e antrenorul")

Date: 2026-10-19. Team Tracker project 16, UI section #3211 (plan v29 item 1062). PR #214.

## Decision

The owner chose a dedicated page for the coach's live location (decision card, 2026-10-19 11:42). The research is in the project's shared folder at `research/locatie-antrenor.md`. Before this change, course locations were shown on Prezență and camp locations on Anunțuri, with two different layouts.

## Scope

- Route `/account/locatie`, under `AccountLayout`. It has no tab of its own; Panou is highlighted, because the Panou banner is the main way in.
- Data comes from the existing `coach-live-location` `list` action (`getActiveLocationSessions`). It already returns both course and camp sessions that the parent is allowed to see, with the coach name and the offer title. No schema or function change.
- One row per live session (coach). Each row has its own per-session consent, keeping the rules for active enrollment, QR presence and revocation (`useCoachLocation`, extracted from `LocationViewer` without changing its behaviour).
- Consented positions appear on one shared map, with one named marker per coach (`CoachesMap`, fit to bounds).
- Entry points:
  - A Panou banner, shown only while at least one session is live.
  - A link card on Prezență and on Anunțuri, which replaces `CurrentLocationSessions` (parent) and `ActiveLocationAnnouncements`.
- Clubs keep `CurrentLocationSessions` on `/club/courses`.

## Out of scope

- Several coaches per course, groups, and assigning children to coaches (feature #496).
- The Android push "the coach started sharing" (separate work).

## States

- Loading, error with retry, and an empty state through `StatusView`.
- A row without consent shows the accept button. A consented row shows the update time, or a waiting message. Errors (stale position, sharing stopped, consent refused) appear in the row, and the coach's marker disappears from the map.
