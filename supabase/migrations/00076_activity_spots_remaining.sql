CREATE OR REPLACE FUNCTION public.activity_spots_remaining(p_activity_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN a.capacity IS NULL THEN NULL
    ELSE GREATEST(
      0,
      a.capacity - COALESCE(
        (
          SELECT count(*)::integer
          FROM public.enrollments e
          WHERE e.kind = 'ACTIVITY'
            AND e.entity_id = a.id
            AND e.status IN ('PENDING', 'ACTIVE')
        ),
        0
      )
    )
  END
  FROM public.activities a
  WHERE a.id = p_activity_id;
$$;

COMMENT ON FUNCTION public.activity_spots_remaining(uuid) IS
    'Locuri ramase la o activitate: capacitate minus inscrierile PENDING si ACTIVE. NULL = capacitate nelimitata.';

REVOKE ALL ON FUNCTION public.activity_spots_remaining(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activity_spots_remaining(uuid) TO anon, authenticated;
