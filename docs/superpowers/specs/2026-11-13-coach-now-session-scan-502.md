# Coach "current session" scan card (To-Do #502)

## Problem

On a phone, the coach's QR attendance scanner was only reachable from Prezență → Cursuri → tap a session. Coaches did not find it.

## Decision

The owner picked option C on 2026-11-13 (card cmsg_01N1bst9PBArftxkbGT7GHgDGoxUjW8ANkjPpw6NGXcMR4). The alternatives were A, a header button on Prezență, and B, a card on Prezență only.

A "Ședința de acum" card appears at the top of both the coach Panou (`/coach`) and Prezență (`/coach/attendance`, Cursuri tab). It shows:

- the start time, the course and the location;
- "Scanează cod QR", which opens the same scanner as the session catalog (native ML Kit or the web camera sheet) and uses the same offline queue;
- "Catalogul", which goes to that session's catalog. On Panou it links to `/coach/attendance?sesiune=<id>`; on Prezență it selects the session.

## Rules

- A session is "current" from 15 minutes before its start until its end. This matches the window of the parent entrance check-in. When several sessions overlap, the one that started earliest is shown.
- Scanning stays disabled until the start, as in the catalog, with the text "Scanarea se deschide la HH:MM".
- The card is not shown when there is no current session or no coach queue (non-coach roles).
- Courses only; activities have no scan.

## Implementation

- `features/coach/attendance/quick-scan/`: `current-session.ts` (pure selection and a 30-second ticker), `use-session-scan.tsx` (scan flow extracted from `AttendanceScanner`, now shared) and `NowSessionCard.tsx`.
- The card reuses the layout of the coach location-share card (icon tile, title and meta, outline and primary buttons); it introduces no new tokens.
- No server or schema change.
