# Feature #280 — Club audiences and the parent announcement feed

## Accepted scope

Delivery plan #108 includes CAMP targeting and the outstanding parent-section #544 criteria. The existing club announcement writer, media storage and combined parent list remain the starting point. Push notifications (#326), a new coach announcement editor (#284), frontend publication and Apple release work are outside this change.

## Club targeting

Clubs can publish to their whole club, a course, an activity or an owned camp. New announcements offer only camps that have not ended in the reader's local timezone. Historical camp announcements keep their target label and remain filterable. Migration 00055 extends the existing ownership resolver and constraint; existing INSERT, UPDATE, SELECT and media policies continue to enforce ownership and active enrollment.

## Parent experience

The existing cards display the actual coach or club name separately from the destination. Course destinations link to `/cursuri/:id`; camp destinations identify the camp. Attachments from both source tables use the existing private media access rules and renderer. External attachment links accept only HTTP(S).

The feed loads twenty server rows across both sources, preserving pinned announcements and reverse publication order. A course filter applies to both direct course announcements and club announcements aimed at that course. General club and camp messages remain available under all announcements. Loading more and retrying preserve the currently displayed list; changing the filter starts from its first page. Loading, empty, initial failure and later-page failure are distinct states.

The existing `user_announcement_views` table records visits. A visit captures its previous watermark once; newer announcements retain their `Nou` badge while that visit is open, including after pagination or filtering. Failed feed loads do not advance the watermark. Server time, user-scoped query keys and monotonic writes prevent local clock drift, account switching and concurrent visits from corrupting the state.

## Data and security

The feed uses caller permissions and existing RLS. It selects public author names explicitly and does not expose profile email, phone or OAuth identifiers. A cursor over pinned state, publication time, source and ID bounds server pagination. Server-issued `asOf` excludes later insertions/publications without promising to freeze subsequent edits. Media failures have a retry action. There are no public fixture endpoints, production debug routes or service credentials in the client.

The cursor carries a deterministic version of the visible ordering. Pin changes, deletions or expiry invalidate an old cursor with `PT409`; the parent reloads the first page while keeping the same visit baseline. Pages from different orderings are never concatenated. Visit writes include the initiating user ID and the server rejects retries under another account.

New course announcements require the authenticated author, in addition to course ownership or the existing administrator permission. Author and announcement ID cannot be changed after insertion. Content and pin updates remain available to the current course owner or administrator, including after a course transfer. Historical authors are not rewritten.

## Verification and delivery

- SQL fixtures: own/foreign club, eligible/ineligible parent, canceled enrollment, hidden/future/expired announcements, source collisions, feed ordering/pagination/filtering, author projection, visit isolation and media access.
- Application tests: API errors, stable new markers, pagination/filter changes, both attachment sources and keyboard-accessible media.
- Browser at 1440×900, 768×1024 and 375×812: target selection, labels, course navigation, media, new markers, loading/retry/empty states and console errors. Simulated fixtures and real backend proof are recorded separately.
- Typecheck, lint, full tests, production build and review of the final revision before merge.
- Human visual acceptance remains required. Tracker human verdicts and production gates are never written by the agent.
