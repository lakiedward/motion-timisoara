-- ============================================================
-- Allow club owners to manage their club's courses + occurrences.
-- Previously only the assigned coach (or admin) could INSERT/UPDATE/
-- DELETE courses; clubs could only SELECT their own. This lets a club
-- owner create/edit/(de)activate courses for their club, assigning a
-- coach from the club's roster.
--
-- SECURITY DEFINER helpers keep the policy free of recursive RLS
-- evaluation against clubs / club_coaches / coach_profiles.
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_club_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM public.clubs WHERE owner_user_id = auth.uid();
$$;

-- user_ids of coaches on the rosters of clubs the caller owns
CREATE OR REPLACE FUNCTION public.my_club_coach_user_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cp.user_id
  FROM public.club_coaches cc
  JOIN public.coach_profiles cp ON cc.coach_profile_id = cp.id
  WHERE cc.club_id IN (SELECT public.my_club_ids());
$$;

-- Club owners manage courses of their club, assigning a roster coach.
CREATE POLICY "courses_manage_club" ON public.courses
  FOR ALL
  USING (club_id IN (SELECT public.my_club_ids()))
  WITH CHECK (
    club_id IN (SELECT public.my_club_ids())
    AND coach_id IN (SELECT public.my_club_coach_user_ids())
  );

-- Club owners manage occurrences of their club's courses.
CREATE POLICY "occurrences_manage_club" ON public.course_occurrences
  FOR ALL
  USING (course_id IN (
    SELECT id FROM public.courses WHERE club_id IN (SELECT public.my_club_ids())
  ));
