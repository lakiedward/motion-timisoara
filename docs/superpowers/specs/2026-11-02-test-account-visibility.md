# Test and demo accounts hidden from public lists (bug #1312)

Date: 2026-11-02. Owner decisions (decision cards in the project thread):
- "Șterge gunoiul, ascunde restul": delete generated test data, hide QA/demo accounts instead of deleting them.
- "Păstrează cele 7 TEST": the seven TEST activities/competitions stay as examples.
- "Construiesc acum, pornesc la lansare": build the mechanism now, flag the accounts only when the owner launches.

## Problem
Public catalog pages show content owned by QA and demo accounts. There is no real club yet and every public course belongs to a test account. The QA accounts cannot be deleted: test threads sign in with them, and test parents are enrolled in their courses.

## Design
- `public.profiles.is_test_account boolean NOT NULL DEFAULT false`. The column gets no column grant, so anon and authenticated can neither read nor change it. The trigger `guard_profile_test_account` also refuses a change from anon or authenticated, because `profiles` has a table-level INSERT/UPDATE grant. The flag is set only from privileged SQL, with the owner's approval.
- `public.hidden_from_public(row)` is a PostgREST computed field for `clubs`, `coach_profiles`, `courses`, `camps`, `activities` and `competitions`. It returns true when the coach account or the club owner's account is flagged. The functions are SECURITY DEFINER with `search_path = ''` over `private.is_test_owner` (no EXECUTE for clients).
- Correction in 00113: a computed field receives the whole row, and `clubs` and `coach_profiles` grant SELECT per column. anon therefore got 42501 on those two tables. They get a real `hidden_from_public` column instead (SELECT granted to anon and authenticated). It is derived from the owner's flag by a BEFORE INSERT/UPDATE trigger, so clients cannot change it, and kept in sync by an AFTER UPDATE trigger on `profiles`.
- Public list queries add `hidden_from_public=is.false`. That covers the course catalog, home programs and the map, activities, camps, competitions, coaches, clubs, club headquarters and the home counters.
- Not filtered: RLS, detail pages opened by direct link, a coach's or club's own profile offer, dashboards, enrollments. Owners, enrolled parents and ADMIN keep full access, so QA flows keep working.

## Alternatives rejected
- An RLS change: it would hide flagged offers from parents enrolled in them and break QA flows.
- Deleting the QA/demo accounts: it would leave the site empty and stop testing.

## Launch step
One owner-approved statement, `UPDATE public.profiles SET is_test_account = true WHERE id IN (...)`, with the account list from `/mnt/project-files/verificari/test-paralel-public/date-test-lista.md` (groups 2 and 3) re-checked at launch. Until then nothing is hidden.

## Verification
- `supabase/tests/test-account-visibility.sql`: hidden rows per table, the private helper not executable, and flag writes refused for authenticated.
- `src/api/public-visibility.test.ts`: which queries filter and which do not.
- Local PostgREST v12 check with the production column grants: `?hidden_from_public=is.false` filters lists, embeds and exact counts on every table.
