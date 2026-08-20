CREATE OR REPLACE FUNCTION public.course_availability()
RETURNS TABLE (course_id uuid, is_full boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, public.course_spots_remaining(c.id) = 0
  FROM public.courses c
  WHERE c.active = true;
$$;

COMMENT ON FUNCTION public.course_availability() IS 'Set-returning is-full flag for the public course list, derived from course_spots_remaining so the occupancy rule lives in one place. Returns no counts; NULL means unlimited capacity.';

REVOKE ALL ON FUNCTION public.course_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_availability() TO anon, authenticated;
