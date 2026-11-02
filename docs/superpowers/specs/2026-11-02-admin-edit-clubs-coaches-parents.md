# Admin edits clubs, coaches and parents

Owner request (2026-11-02): an administrator must be able to edit clubs, coaches and parents.

## Before

- `/admin/users` could only enable or disable an account; `/admin/clubs` could only approve a new club.
- RLS already allowed ADMIN to update `clubs`, `coach_profiles` and `profiles` (00011), and club-asset storage policies already allow ADMIN (00089). The gap was UI only, plus one read: `profiles.phone` is not granted to `authenticated` (00036).

## Design

- `/admin/clubs/:id/edit` reuses `ClubProfilePage` with `portal="admin"`: same form, same fields, same logo/cover upload. The club is read through `getAdminClub` (public columns only); billing columns stay out, as for the club owner's form.
- `/admin/users/:id/edit` (`AdminUserEditPage`): name, phone and, for coaches, bio. The login email is read-only because changing `profiles.email` would not change the auth identity. CLUB accounts link to Cluburi for club data.
- "Editează" sits next to the existing row action on both lists, with the same outline button style as Cursuri.
- Migration 00108 adds `admin_user_detail(uuid)`. Until applied, the page falls back to `admin_users()` and hides the phone field; the save never sends `phone` it has not read, so a phone cannot be cleared by accident.

## Out of scope

Billing/company data, coach sports and photo, parents' children, changing a role or login email.
