-- Feature #493 slice 1: a parent reads the camp arrival/departure of their
-- own children on /account/attendance.
--
-- public.camp_participation stays service-only (00045): no table grant or
-- policy changes, so writes still go only through the live-location edge
-- function. This read-only SECURITY DEFINER function returns the rows whose
-- enrollment belongs to a child of the caller, with the camp title and
-- period. Callers without a user get nothing; only authenticated may execute.

CREATE OR REPLACE FUNCTION public.get_my_children_camp_attendance()
RETURNS TABLE (
    id UUID,
    child_id UUID,
    camp_id UUID,
    camp_title TEXT,
    period_start DATE,
    period_end DATE,
    arrived_at TIMESTAMPTZ,
    departed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT cp.id, e.child_id, cp.camp_id, c.title, c.period_start, c.period_end,
        cp.arrived_at, cp.departed_at
    FROM public.camp_participation cp
    JOIN public.enrollments e ON e.id = cp.enrollment_id AND e.kind = 'CAMP' AND e.entity_id = cp.camp_id
    JOIN public.children ch ON ch.id = e.child_id
    JOIN public.camps c ON c.id = cp.camp_id
    WHERE (SELECT auth.uid()) IS NOT NULL
      AND ch.parent_id = (SELECT auth.uid())
    ORDER BY cp.arrived_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_children_camp_attendance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_children_camp_attendance() TO authenticated;
