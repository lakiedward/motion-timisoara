-- ============================================================
-- Phase 9 hardening (part 1): RLS policy regeneration.
--
-- Goals (advisor lints 0003 auth_rls_initplan + 0006 multiple_permissive_policies):
--   1. ONE permissive policy per (table, action) — merge the per-role policies
--      (public-read + owner + coach + club + admin) via OR. Eliminates the
--      "multiple permissive policies" overhead (405 findings).
--   2. initplan-safe: every auth.uid() / get_my_role() is wrapped in a scalar
--      subselect `(select ...)` so it is evaluated once per query, not per row
--      (44 findings).
--   3. Explicit TO clauses: public-readable tables -> {anon, authenticated};
--      private tables and all writes -> {authenticated}. anon never evaluates
--      the privileged branches for private tables.
--
-- Semantics are PRESERVED: each new policy's condition is the exact OR-union of
-- the policies it replaces (verified against the pre-migration pg_policies dump).
--
-- Also closes a privilege-escalation hole: a BEFORE UPDATE trigger on profiles
-- prevents non-admins from changing their own `role` / `enabled`.
--
-- Helper functions stay in `public` (they are referenced by both these policies
-- and the storage.objects policies); revoking their EXECUTE was verified to
-- break policy evaluation, so that advisor remediation is intentionally not
-- applied. Two genuinely-unused helpers are dropped.
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');

CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE TO authenticated
  USING ((select public.get_my_role()) = 'ADMIN');

-- Block non-admins from escalating their own role / toggling enabled.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.enabled IS DISTINCT FROM OLD.enabled)
     AND public.get_my_role() IS DISTINCT FROM 'ADMIN'
     AND current_user NOT IN ('service_role', 'supabase_admin', 'supabase_auth_admin', 'postgres') THEN
    RAISE EXCEPTION 'Only administrators may change role or enabled';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- ------------------------------------------------------------
-- SPORTS  (public read; admin writes)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "sports_select_public" ON public.sports;
DROP POLICY IF EXISTS "sports_admin_all" ON public.sports;

CREATE POLICY "sports_select" ON public.sports
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sports_insert" ON public.sports
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "sports_update" ON public.sports
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "sports_delete" ON public.sports
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- COACH_PROFILES  (public read; owner insert/update; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "coach_profiles_select_public" ON public.coach_profiles;
DROP POLICY IF EXISTS "coach_profiles_update_own" ON public.coach_profiles;
DROP POLICY IF EXISTS "coach_profiles_insert_own" ON public.coach_profiles;
DROP POLICY IF EXISTS "coach_profiles_admin_all" ON public.coach_profiles;

CREATE POLICY "coach_profiles_select" ON public.coach_profiles
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "coach_profiles_insert" ON public.coach_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_profiles_update" ON public.coach_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_profiles_delete" ON public.coach_profiles
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- COACH_SPORTS  (public read; own via coach_profile; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "coach_sports_select_public" ON public.coach_sports;
DROP POLICY IF EXISTS "coach_sports_manage_own" ON public.coach_sports;
DROP POLICY IF EXISTS "coach_sports_admin_all" ON public.coach_sports;

CREATE POLICY "coach_sports_select" ON public.coach_sports
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "coach_sports_insert" ON public.coach_sports
  FOR INSERT TO authenticated
  WITH CHECK (coach_profile_id = (select public.get_my_coach_profile_id()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_sports_update" ON public.coach_sports
  FOR UPDATE TO authenticated
  USING (coach_profile_id = (select public.get_my_coach_profile_id()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (coach_profile_id = (select public.get_my_coach_profile_id()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_sports_delete" ON public.coach_sports
  FOR DELETE TO authenticated
  USING (coach_profile_id = (select public.get_my_coach_profile_id()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- CLUBS  (public read; owner insert/update; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "clubs_select_public" ON public.clubs;
DROP POLICY IF EXISTS "clubs_update_owner" ON public.clubs;
DROP POLICY IF EXISTS "clubs_insert_owner" ON public.clubs;
DROP POLICY IF EXISTS "clubs_admin_all" ON public.clubs;

CREATE POLICY "clubs_select" ON public.clubs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "clubs_update" ON public.clubs
  FOR UPDATE TO authenticated
  USING (owner_user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (owner_user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "clubs_delete" ON public.clubs
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- CLUB_SPORTS  (public read; owner via club; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "club_sports_select_public" ON public.club_sports;
DROP POLICY IF EXISTS "club_sports_manage_owner" ON public.club_sports;
DROP POLICY IF EXISTS "club_sports_admin_all" ON public.club_sports;

CREATE POLICY "club_sports_select" ON public.club_sports
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "club_sports_insert" ON public.club_sports
  FOR INSERT TO authenticated
  WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_sports_update" ON public.club_sports
  FOR UPDATE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_sports_delete" ON public.club_sports
  FOR DELETE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- CLUB_COACHES  (public read; owner via club; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "club_coaches_select_public" ON public.club_coaches;
DROP POLICY IF EXISTS "club_coaches_manage_owner" ON public.club_coaches;
DROP POLICY IF EXISTS "club_coaches_admin_all" ON public.club_coaches;

CREATE POLICY "club_coaches_select" ON public.club_coaches
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "club_coaches_insert" ON public.club_coaches
  FOR INSERT TO authenticated
  WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_coaches_update" ON public.club_coaches
  FOR UPDATE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_coaches_delete" ON public.club_coaches
  FOR DELETE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- LOCATIONS  (active public OR privileged-role read; owner/club write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "locations_select_public_active" ON public.locations;
DROP POLICY IF EXISTS "locations_select_privileged" ON public.locations;
DROP POLICY IF EXISTS "locations_manage_own" ON public.locations;
DROP POLICY IF EXISTS "locations_manage_club" ON public.locations;
DROP POLICY IF EXISTS "locations_admin_all" ON public.locations;

CREATE POLICY "locations_select" ON public.locations
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR (select public.get_my_role()) IN ('COACH', 'ADMIN', 'CLUB')
    OR created_by_user_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
  );
CREATE POLICY "locations_insert" ON public.locations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_user_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "locations_update" ON public.locations
  FOR UPDATE TO authenticated
  USING (
    created_by_user_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  )
  WITH CHECK (
    created_by_user_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "locations_delete" ON public.locations
  FOR DELETE TO authenticated
  USING (
    created_by_user_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  );

-- ------------------------------------------------------------
-- COURSES  (active public + coach/club own read; coach/club/admin write)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "courses_select_public_active" ON public.courses;
DROP POLICY IF EXISTS "courses_select_coach_own" ON public.courses;
DROP POLICY IF EXISTS "courses_select_club_own" ON public.courses;
DROP POLICY IF EXISTS "courses_insert_coach" ON public.courses;
DROP POLICY IF EXISTS "courses_update_coach_own" ON public.courses;
DROP POLICY IF EXISTS "courses_manage_club" ON public.courses;
DROP POLICY IF EXISTS "courses_admin_all" ON public.courses;

CREATE POLICY "courses_select" ON public.courses
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    OR coach_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "courses_insert" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    coach_id = (select auth.uid())
    OR (club_id IN (SELECT public.my_club_ids()) AND coach_id IN (SELECT public.my_club_coach_user_ids()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "courses_update" ON public.courses
  FOR UPDATE TO authenticated
  USING (
    coach_id = (select auth.uid())
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  )
  WITH CHECK (
    coach_id = (select auth.uid())
    OR (club_id IN (SELECT public.my_club_ids()) AND coach_id IN (SELECT public.my_club_coach_user_ids()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "courses_delete" ON public.courses
  FOR DELETE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- COURSE_OCCURRENCES  (public read; coach/club manage; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "occurrences_select_public" ON public.course_occurrences;
DROP POLICY IF EXISTS "occurrences_manage_coach" ON public.course_occurrences;
DROP POLICY IF EXISTS "occurrences_manage_club" ON public.course_occurrences;
DROP POLICY IF EXISTS "occurrences_admin_all" ON public.course_occurrences;

CREATE POLICY "occurrences_select" ON public.course_occurrences
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "occurrences_insert" ON public.course_occurrences
  FOR INSERT TO authenticated
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR course_id IN (SELECT id FROM public.courses WHERE club_id IN (SELECT public.my_club_ids()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "occurrences_update" ON public.course_occurrences
  FOR UPDATE TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR course_id IN (SELECT id FROM public.courses WHERE club_id IN (SELECT public.my_club_ids()))
    OR (select public.get_my_role()) = 'ADMIN'
  )
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR course_id IN (SELECT id FROM public.courses WHERE club_id IN (SELECT public.my_club_ids()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "occurrences_delete" ON public.course_occurrences
  FOR DELETE TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR course_id IN (SELECT id FROM public.courses WHERE club_id IN (SELECT public.my_club_ids()))
    OR (select public.get_my_role()) = 'ADMIN'
  );

-- ------------------------------------------------------------
-- CAMPS  (public read; admin writes)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "camps_select_public" ON public.camps;
DROP POLICY IF EXISTS "camps_admin_all" ON public.camps;

CREATE POLICY "camps_select" ON public.camps
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "camps_insert" ON public.camps
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "camps_update" ON public.camps
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "camps_delete" ON public.camps
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- ACTIVITIES  (active public + coach own read; coach write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "activities_select_public_active" ON public.activities;
DROP POLICY IF EXISTS "activities_select_coach_own" ON public.activities;
DROP POLICY IF EXISTS "activities_insert_coach" ON public.activities;
DROP POLICY IF EXISTS "activities_update_coach_own" ON public.activities;
DROP POLICY IF EXISTS "activities_admin_all" ON public.activities;

CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO anon, authenticated
  USING (active = true OR coach_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (coach_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "activities_update" ON public.activities
  FOR UPDATE TO authenticated
  USING (coach_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (coach_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "activities_delete" ON public.activities
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- CHILDREN  (parent own + coach/club enrolled + admin; parent write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "children_select_parent_own" ON public.children;
DROP POLICY IF EXISTS "children_select_coach_enrolled" ON public.children;
DROP POLICY IF EXISTS "children_select_club_enrolled" ON public.children;
DROP POLICY IF EXISTS "children_insert_parent" ON public.children;
DROP POLICY IF EXISTS "children_update_parent_own" ON public.children;
DROP POLICY IF EXISTS "children_delete_parent_own" ON public.children;
DROP POLICY IF EXISTS "children_admin_all" ON public.children;

CREATE POLICY "children_select" ON public.children
  FOR SELECT TO authenticated
  USING (
    parent_id = (select auth.uid())
    OR id IN (SELECT public.coach_enrolled_child_ids())
    OR id IN (SELECT public.club_enrolled_child_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "children_insert" ON public.children
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "children_update" ON public.children
  FOR UPDATE TO authenticated
  USING (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "children_delete" ON public.children
  FOR DELETE TO authenticated
  USING (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- ENROLLMENTS  (parent/coach/club read; admin all; writes via service-role EFs)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "enrollments_select_parent" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_select_coach" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_select_club" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_admin_all" ON public.enrollments;

CREATE POLICY "enrollments_select" ON public.enrollments
  FOR SELECT TO authenticated
  USING (
    child_id IN (SELECT public.my_child_ids())
    OR ((kind = 'COURSE' AND entity_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid())))
        OR (kind = 'ACTIVITY' AND entity_id IN (SELECT id FROM public.activities WHERE coach_id = (select auth.uid()))))
    OR (kind = 'COURSE' AND entity_id IN (
          SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id
          WHERE cl.owner_user_id = (select auth.uid())))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "enrollments_insert" ON public.enrollments
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "enrollments_update" ON public.enrollments
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "enrollments_delete" ON public.enrollments
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- PAYMENTS  (parent/coach/club read; admin all; writes via service-role EFs)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "payments_select_parent" ON public.payments;
DROP POLICY IF EXISTS "payments_select_coach" ON public.payments;
DROP POLICY IF EXISTS "payments_select_club" ON public.payments;
DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated
  USING (
    enrollment_id IN (
      SELECT e.id FROM public.enrollments e JOIN public.children c ON e.child_id = c.id
      WHERE c.parent_id = (select auth.uid()))
    OR enrollment_id IN (
      SELECT e.id FROM public.enrollments e
      WHERE (e.kind = 'COURSE' AND e.entity_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid())))
         OR (e.kind = 'ACTIVITY' AND e.entity_id IN (SELECT id FROM public.activities WHERE coach_id = (select auth.uid()))))
    OR enrollment_id IN (
      SELECT e.id FROM public.enrollments e
      WHERE e.kind = 'COURSE' AND e.entity_id IN (
        SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id
        WHERE cl.owner_user_id = (select auth.uid())))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "payments_delete" ON public.payments
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- MONTHLY_PAYMENTS  (parent/coach read; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "monthly_payments_select_parent" ON public.monthly_payments;
DROP POLICY IF EXISTS "monthly_payments_select_coach" ON public.monthly_payments;
DROP POLICY IF EXISTS "monthly_payments_admin_all" ON public.monthly_payments;

CREATE POLICY "monthly_payments_select" ON public.monthly_payments
  FOR SELECT TO authenticated
  USING (
    enrollment_id IN (
      SELECT e.id FROM public.enrollments e JOIN public.children c ON e.child_id = c.id
      WHERE c.parent_id = (select auth.uid()))
    OR enrollment_id IN (
      SELECT e.id FROM public.enrollments e
      WHERE (e.kind = 'COURSE' AND e.entity_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid())))
         OR (e.kind = 'ACTIVITY' AND e.entity_id IN (SELECT id FROM public.activities WHERE coach_id = (select auth.uid()))))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "monthly_payments_insert" ON public.monthly_payments
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "monthly_payments_update" ON public.monthly_payments
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "monthly_payments_delete" ON public.monthly_payments
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- ATTENDANCE  (parent/coach/club read; coach write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_select_parent" ON public.attendance;
DROP POLICY IF EXISTS "attendance_manage_coach" ON public.attendance;
DROP POLICY IF EXISTS "attendance_select_club" ON public.attendance;
DROP POLICY IF EXISTS "attendance_admin_all" ON public.attendance;

CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    child_id IN (SELECT public.my_child_ids())
    OR occurrence_id IN (
      SELECT co.id FROM public.course_occurrences co JOIN public.courses c ON co.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR occurrence_id IN (
      SELECT co.id FROM public.course_occurrences co
      JOIN public.courses c ON co.course_id = c.id
      JOIN public.clubs cl ON c.club_id = cl.id
      WHERE cl.owner_user_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    occurrence_id IN (
      SELECT co.id FROM public.course_occurrences co JOIN public.courses c ON co.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    occurrence_id IN (
      SELECT co.id FROM public.course_occurrences co JOIN public.courses c ON co.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  )
  WITH CHECK (
    occurrence_id IN (
      SELECT co.id FROM public.course_occurrences co JOIN public.courses c ON co.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "attendance_delete" ON public.attendance
  FOR DELETE TO authenticated
  USING (
    occurrence_id IN (
      SELECT co.id FROM public.course_occurrences co JOIN public.courses c ON co.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );

-- ------------------------------------------------------------
-- COURSE_PHOTOS  (public read; coach/club manage; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "course_photos_select_public" ON public.course_photos;
DROP POLICY IF EXISTS "course_photos_manage_coach" ON public.course_photos;
DROP POLICY IF EXISTS "course_photos_manage_club" ON public.course_photos;
DROP POLICY IF EXISTS "course_photos_admin_all" ON public.course_photos;

CREATE POLICY "course_photos_select" ON public.course_photos
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "course_photos_insert" ON public.course_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR course_id IN (SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id WHERE cl.owner_user_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "course_photos_update" ON public.course_photos
  FOR UPDATE TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR course_id IN (SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id WHERE cl.owner_user_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  )
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR course_id IN (SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id WHERE cl.owner_user_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "course_photos_delete" ON public.course_photos
  FOR DELETE TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR course_id IN (SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id WHERE cl.owner_user_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );

-- ------------------------------------------------------------
-- COURSE_ANNOUNCEMENTS  (parent enrolled + coach own read; coach write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "announcements_select_parent" ON public.course_announcements;
DROP POLICY IF EXISTS "announcements_manage_coach" ON public.course_announcements;
DROP POLICY IF EXISTS "announcements_admin_all" ON public.course_announcements;

CREATE POLICY "course_announcements_select" ON public.course_announcements
  FOR SELECT TO authenticated
  USING (
    course_id IN (
      SELECT e.entity_id FROM public.enrollments e JOIN public.children c ON e.child_id = c.id
      WHERE c.parent_id = (select auth.uid()) AND e.kind = 'COURSE' AND e.status = 'ACTIVE')
    OR course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "course_announcements_insert" ON public.course_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "course_announcements_update" ON public.course_announcements
  FOR UPDATE TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  )
  WITH CHECK (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "course_announcements_delete" ON public.course_announcements
  FOR DELETE TO authenticated
  USING (
    course_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );

-- ------------------------------------------------------------
-- ANNOUNCEMENT_ATTACHMENTS  (read via visible announcement; coach write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "attachments_select_via_announcement" ON public.announcement_attachments;
DROP POLICY IF EXISTS "attachments_manage_coach" ON public.announcement_attachments;
DROP POLICY IF EXISTS "attachments_admin_all" ON public.announcement_attachments;

CREATE POLICY "announcement_attachments_select" ON public.announcement_attachments
  FOR SELECT TO authenticated
  USING (announcement_id IN (SELECT id FROM public.course_announcements));
CREATE POLICY "announcement_attachments_insert" ON public.announcement_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    announcement_id IN (
      SELECT ca.id FROM public.course_announcements ca JOIN public.courses c ON ca.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "announcement_attachments_update" ON public.announcement_attachments
  FOR UPDATE TO authenticated
  USING (
    announcement_id IN (
      SELECT ca.id FROM public.course_announcements ca JOIN public.courses c ON ca.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  )
  WITH CHECK (
    announcement_id IN (
      SELECT ca.id FROM public.course_announcements ca JOIN public.courses c ON ca.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "announcement_attachments_delete" ON public.announcement_attachments
  FOR DELETE TO authenticated
  USING (
    announcement_id IN (
      SELECT ca.id FROM public.course_announcements ca JOIN public.courses c ON ca.course_id = c.id
      WHERE c.coach_id = (select auth.uid()))
    OR (select public.get_my_role()) = 'ADMIN'
  );

-- ------------------------------------------------------------
-- CLUB_ANNOUNCEMENTS  (public active-window + owner read; owner write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "club_announcements_select_public" ON public.club_announcements;
DROP POLICY IF EXISTS "club_announcements_manage_owner" ON public.club_announcements;
DROP POLICY IF EXISTS "club_announcements_admin_all" ON public.club_announcements;

CREATE POLICY "club_announcements_select" ON public.club_announcements
  FOR SELECT TO anon, authenticated
  USING (
    (is_active = true AND (publish_at IS NULL OR publish_at <= now()) AND (expires_at IS NULL OR expires_at > now()))
    OR club_id IN (SELECT public.my_club_ids())
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "club_announcements_insert" ON public.club_announcements
  FOR INSERT TO authenticated
  WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_announcements_update" ON public.club_announcements
  FOR UPDATE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_announcements_delete" ON public.club_announcements
  FOR DELETE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- COURSE_RATINGS  (public read; parent own write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "course_ratings_select_public" ON public.course_ratings;
DROP POLICY IF EXISTS "course_ratings_manage_parent" ON public.course_ratings;
DROP POLICY IF EXISTS "course_ratings_admin_all" ON public.course_ratings;

CREATE POLICY "course_ratings_select" ON public.course_ratings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "course_ratings_insert" ON public.course_ratings
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "course_ratings_update" ON public.course_ratings
  FOR UPDATE TO authenticated
  USING (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "course_ratings_delete" ON public.course_ratings
  FOR DELETE TO authenticated
  USING (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- COACH_RATINGS  (public read; parent own write; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "coach_ratings_select_public" ON public.coach_ratings;
DROP POLICY IF EXISTS "coach_ratings_manage_parent" ON public.coach_ratings;
DROP POLICY IF EXISTS "coach_ratings_admin_all" ON public.coach_ratings;

CREATE POLICY "coach_ratings_select" ON public.coach_ratings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "coach_ratings_insert" ON public.coach_ratings
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_ratings_update" ON public.coach_ratings
  FOR UPDATE TO authenticated
  USING (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_ratings_delete" ON public.coach_ratings
  FOR DELETE TO authenticated
  USING (parent_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- INVOICES  (parent/coach read; admin all)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "invoices_select_parent" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select_coach" ON public.invoices;
DROP POLICY IF EXISTS "invoices_admin_all" ON public.invoices;

CREATE POLICY "invoices_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    payment_id IN (
      SELECT p.id FROM public.payments p
      JOIN public.enrollments e ON p.enrollment_id = e.id
      JOIN public.children c ON e.child_id = c.id
      WHERE c.parent_id = (select auth.uid()))
    OR payment_id IN (
      SELECT p.id FROM public.payments p JOIN public.enrollments e ON p.enrollment_id = e.id
      WHERE (e.kind = 'COURSE' AND e.entity_id IN (SELECT id FROM public.courses WHERE coach_id = (select auth.uid())))
         OR (e.kind = 'ACTIVITY' AND e.entity_id IN (SELECT id FROM public.activities WHERE coach_id = (select auth.uid()))))
    OR (select public.get_my_role()) = 'ADMIN'
  );
CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "invoices_delete" ON public.invoices
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- COACH_INVITATION_CODES  (admin only)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "coach_codes_admin_all" ON public.coach_invitation_codes;

CREATE POLICY "coach_codes_select" ON public.coach_invitation_codes
  FOR SELECT TO authenticated USING ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_codes_insert" ON public.coach_invitation_codes
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_codes_update" ON public.coach_invitation_codes
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "coach_codes_delete" ON public.coach_invitation_codes
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- CLUB_INVITATION_CODES  (club owner + admin)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "club_codes_manage_owner" ON public.club_invitation_codes;
DROP POLICY IF EXISTS "club_codes_admin_all" ON public.club_invitation_codes;

CREATE POLICY "club_codes_select" ON public.club_invitation_codes
  FOR SELECT TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_codes_insert" ON public.club_invitation_codes
  FOR INSERT TO authenticated
  WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_codes_update" ON public.club_invitation_codes
  FOR UPDATE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "club_codes_delete" ON public.club_invitation_codes
  FOR DELETE TO authenticated
  USING (club_id IN (SELECT public.my_club_ids()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- USER_RECENT_LOCATIONS  (own + admin)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "recent_locations_manage_own" ON public.user_recent_locations;
DROP POLICY IF EXISTS "recent_locations_admin_all" ON public.user_recent_locations;

CREATE POLICY "recent_locations_select" ON public.user_recent_locations
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "recent_locations_insert" ON public.user_recent_locations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "recent_locations_update" ON public.user_recent_locations
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN')
  WITH CHECK (user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');
CREATE POLICY "recent_locations_delete" ON public.user_recent_locations
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- AUDIT_LOGS  (admin only)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;

CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated USING ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "audit_logs_update" ON public.audit_logs
  FOR UPDATE TO authenticated USING ((select public.get_my_role()) = 'ADMIN')
  WITH CHECK ((select public.get_my_role()) = 'ADMIN');
CREATE POLICY "audit_logs_delete" ON public.audit_logs
  FOR DELETE TO authenticated USING ((select public.get_my_role()) = 'ADMIN');

-- ------------------------------------------------------------
-- Drop genuinely-unused SECURITY DEFINER helpers (not referenced by any policy).
-- Reduces the exposed-RPC surface (advisor 0028/0029).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_my_child(uuid);
DROP FUNCTION IF EXISTS public.get_my_club_id();
