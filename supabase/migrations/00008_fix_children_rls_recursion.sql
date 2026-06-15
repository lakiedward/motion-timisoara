-- ============================================================
-- Fix infinite recursion between children and enrollments RLS policies.
-- children's SELECT policies queried enrollments while enrollments' SELECT
-- policy queried children → recursion (manifested as a 500 on children ops).
-- Break it with SECURITY DEFINER helpers that bypass RLS on the other table.
-- ============================================================

CREATE OR REPLACE FUNCTION public.my_child_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM public.children WHERE parent_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.coach_enrolled_child_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.child_id FROM public.enrollments e
    JOIN public.courses c ON e.entity_id = c.id AND e.kind = 'COURSE'
    WHERE c.coach_id = auth.uid() AND e.status = 'ACTIVE'
  UNION
  SELECT e.child_id FROM public.enrollments e
    JOIN public.activities a ON e.entity_id = a.id AND e.kind = 'ACTIVITY'
    WHERE a.coach_id = auth.uid() AND e.status = 'ACTIVE';
$$;

CREATE OR REPLACE FUNCTION public.club_enrolled_child_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.child_id FROM public.enrollments e
    JOIN public.courses c ON e.entity_id = c.id AND e.kind = 'COURSE'
    JOIN public.clubs cl ON c.club_id = cl.id
    WHERE cl.owner_user_id = auth.uid() AND e.status = 'ACTIVE';
$$;

DROP POLICY "children_select_coach_enrolled" ON public.children;
CREATE POLICY "children_select_coach_enrolled" ON public.children
  FOR SELECT USING (id IN (SELECT public.coach_enrolled_child_ids()));

DROP POLICY "children_select_club_enrolled" ON public.children;
CREATE POLICY "children_select_club_enrolled" ON public.children
  FOR SELECT USING (id IN (SELECT public.club_enrolled_child_ids()));

DROP POLICY "enrollments_select_parent" ON public.enrollments;
CREATE POLICY "enrollments_select_parent" ON public.enrollments
  FOR SELECT USING (child_id IN (SELECT public.my_child_ids()));
