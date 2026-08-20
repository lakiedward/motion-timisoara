CREATE OR REPLACE FUNCTION public.course_availability()
RETURNS TABLE (course_id uuid, is_full boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.id,
    c.capacity IS NOT NULL
      AND (
        SELECT count(*)
        FROM public.enrollments e
        WHERE e.kind = 'COURSE'
          AND e.entity_id = c.id
          AND e.status IN ('PENDING', 'ACTIVE')
      ) >= c.capacity
  FROM public.courses c
  WHERE c.active = true;
$$;

COMMENT ON FUNCTION public.course_availability() IS 'Per-active-course is-full flag for the public course list. Deliberately returns no counts.';

REVOKE ALL ON FUNCTION public.course_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_availability() TO anon, authenticated;
