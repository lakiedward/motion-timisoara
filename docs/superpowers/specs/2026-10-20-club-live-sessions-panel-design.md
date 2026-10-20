# Club live-location sessions panel (/club/courses) — section #3927

## Decision

The owner chose direction A on 2026-10-20: one list with sharing sessions first, instead of grouping rows under "Partajează acum" / "Fără partajare" headings.

## Behavior

- Rows come from current course occurrences (`course_occurrences`) joined client-side with the club's active sharing sessions (`coach-live-location` action `list`, which already allows the CLUB role).
- Each row shows the course name, the coach name and the occurrence range in Europe/Bucharest time (`13:02–14:00`), plus "Partajează acum" (green dot, as on the parent banner) or "Nu partajează". The status sits on the right from 640 px and under the meta line on phones.
- Sharing rows sort first, then the most recent start. The first three are visible; the rest open with "Arată toate (N)".
- Opening a sharing row renders the shared `LocationViewer` (map, "Actualizată la", accuracy, "Partajare activă până la"). Opening a row without sharing shows a neutral note instead of calling the viewer, which would otherwise surface a red error.
- A club without courses does not see the panel. Loading shows a skeleton; any failed source shows `StatusView` with "Reîncearcă", retrying only the failed sources.

## Tradeoffs

- The optional "hours without seconds" criterion is not applied to "Actualizată la", because that string belongs to the viewer shared with parents and coaches; changing it would touch their sections too.
- Active sessions are polled every 15 s and occurrences every 30 s; sessions are only requested while at least one occurrence is running.
