-- Public remaining seats for a course (capacity − PENDING/ACTIVE enrollments).
-- SECURITY DEFINER so anon/authenticated can read a scalar without enrollments SELECT.

CREATE OR REPLACE FUNCTION public.course_spots_remaining(p_course_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN c.capacity IS NULL THEN NULL
    ELSE GREATEST(
      0,
      c.capacity - COALESCE(
        (
          SELECT count(*)::integer
          FROM public.enrollments e
          WHERE e.kind = 'COURSE'
            AND e.entity_id = c.id
            AND e.status IN ('PENDING', 'ACTIVE')
        ),
        0
      )
    )
  END
  FROM public.courses c
  WHERE c.id = p_course_id
    AND c.active = true;
$$;

REVOKE ALL ON FUNCTION public.course_spots_remaining(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_spots_remaining(uuid) TO anon, authenticated;
