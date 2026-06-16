-- ============================================================
-- Close a pre-existing authorization gap (predates 00011, which preserved it):
-- the courses/activities INSERT policies only required coach_id = auth.uid(),
-- so ANY authenticated user (e.g. a PARENT) could create a course/activity
-- naming themselves coach — and it would appear in public listings.
--
-- Add a role gate to the self-as-coach branch: the caller must actually be a
-- COACH (ADMIN keeps full access via its own branch; the club branch is
-- unchanged and still requires a roster coach).
-- ============================================================

-- COURSES
DROP POLICY IF EXISTS "courses_insert" ON public.courses;
CREATE POLICY "courses_insert" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    (coach_id = (select auth.uid()) AND (select public.get_my_role()) IN ('COACH', 'ADMIN'))
    OR (club_id IN (SELECT public.my_club_ids()) AND coach_id IN (SELECT public.my_club_coach_user_ids()))
    OR (select public.get_my_role()) = 'ADMIN'
  );

-- ACTIVITIES
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    (coach_id = (select auth.uid()) AND (select public.get_my_role()) IN ('COACH', 'ADMIN'))
    OR (select public.get_my_role()) = 'ADMIN'
  );
