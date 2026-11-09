# Disabled account keeps a working session (To-Do #333)

## Residual after To-Do #326

`admin-set-user-enabled` bans the account in Supabase Auth and sets `profiles.enabled = false`.
Supabase Auth then refuses the refresh-token grant (`400 user_banned`) and `/auth/v1/user`
(`403 user_banned`), but it does not revoke the sessions and does not invalidate access tokens
already issued. The product project has `jwt_exp = 3600`, so an open tab keeps a valid access
token for up to 60 minutes after the admin presses Dezactivează.

During that window PostgREST checks only the token signature. Migration 00132 already closed the
reads of children, enrollments, attendance and payments, and every edge function checks the live
role through `getActiveUserRole()`. What stayed open were the policies that compare
`auth.uid()` directly: course announcements (with push to parents), courses, activities,
occurrences, photos, locations, the coach profile, the own club, children and ratings of a
parent. The open tab also kept showing the account as signed in.

## Decision

1. **One check before every Data API request.** `public.reject_inactive_account()` is registered
   as `pgrst.db_pre_request`. For a caller whose profile has `enabled = false` or `deleted_at`
   set, it raises `SQLSTATE 'PGRST'` with HTTP 403 and code `account_disabled` or
   `account_deleted`. Anonymous, `service_role` and profile-less callers pass with one primary-key
   lookup. This covers every table, view and RPC at once instead of rewriting about thirty
   policies, and it applies to policies added later.
2. **The app closes the session with a reason.** The Supabase client fetch reports a `403
   account_disabled` from `/rest/v1/`, or `user_banned` from the refresh grant or `/auth/v1/user`.
   `AuthProvider` then shows one toast („Contul tău a fost dezactivat…”), clears push on this
   device and signs out with `scope: 'local'`; the route guard sends the user to the login page.
   Returning to the tab re-reads `my_profile()` so an idle tab also notices. A banned password
   sign-in shows the same reason instead of the connection error.

## Not covered

- Storage and Realtime do not run `db_pre_request`. A disabled user keeps, until the token
  expires, only uploads into their own folders (coach photo, child photos, announcement media
  under their own course); the parent account deletion needs Storage after
  `delete_my_account()`, so those policies stay as they are.
- Sessions are not revoked server-side: the ban already blocks refresh, and re-enabling the
  account should not need a new sign-in on every device.

## Rollback

`ALTER ROLE authenticator RESET pgrst.db_pre_request; NOTIFY pgrst, 'reload config';`
