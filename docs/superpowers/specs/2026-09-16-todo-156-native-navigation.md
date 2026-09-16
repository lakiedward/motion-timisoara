# To-Do #156 — Native navigation

## Accepted structure

The owner accepted the role-specific structure on 2026-09-16, before implementation.
The Android and iOS applications use a fixed top bar with the page title and a back
control on secondary screens, and a fixed bottom bar with icons and labels.

| Role | Bottom destinations, in order |
| --- | --- |
| Parent | Home, Explore, Children, Announcements, Account |
| Coach | Dashboard, Courses, Camps, Attendance, Account |
| Club | Dashboard, Courses, Camps, Announcements, Account |
| Admin | Dashboard, Users, Clubs, Camps, Account |

Explore groups public courses, activities, camps and the map. Account groups the
remaining destinations permitted to the current role, personal enrollments and
attendance, public information and sign out. Signed-out users can browse public
content and reach authentication from Account. No hamburger or horizontally
scrolling tab strip remains in the native shell. Existing web navigation stays intact.

## Implementation contract

Use one native shell at the root, keeping auth, notification and payment listeners
mounted outside route changes. Reuse existing routes and guards, with shared route
definitions for portal destinations. Native navigation is selected by Capacitor;
a development-only UI preview flag must not activate device plugins or bypass auth.
Reserve content space for both bars and device safe areas. Preserve keyboard access,
dark/light tokens, deep links and access to all four roles' existing destinations.
Use existing Tailwind spacing for bar heights and CSS environment insets; no palette
or additional native dependency is introduced.

## Verification and delivery

Test role navigation, active tabs on detail routes, fallback back targets, auth/error
states and sign-out failure. Run typecheck, lint, Vitest and build. Inspect the native
UI at 375×812, and web regression at 1440×900, 768×1024 and 375×812. Browser rendering
does not prove device safe areas, software keyboard or Android back behavior; record
actual Android/iOS evidence separately. Human visual acceptance is required before
merge. Do not write UI Coverage human gates. Publication remains outside this task.
