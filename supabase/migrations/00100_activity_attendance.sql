-- Feature #520 slice 1: attendance for one-off activities.
--
-- public.activity_attendance holds one PRESENT/ABSENT row per (activity, child).
-- Clients cannot write the table; the coach of the activity, the owning club
-- or ADMIN record attendance only through record_activity_attendance(), which
-- checks the caller with pot_administra_activitate() (00066) and requires an
-- ACTIVE enrollment of the child in that activity. Activities have no session
-- balance, so nothing is debited. Reads follow RLS: the child's parent, the
-- activity's coach, the owning club and ADMIN.

CREATE TABLE public.activity_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT')),
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT activity_attendance_activity_child_unique UNIQUE (activity_id, child_id)
);
CREATE INDEX activity_attendance_child_idx ON public.activity_attendance(child_id);

ALTER TABLE public.activity_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_attendance FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.activity_attendance TO authenticated;
GRANT ALL ON public.activity_attendance TO service_role;

CREATE POLICY activity_attendance_select ON public.activity_attendance
    FOR SELECT TO authenticated
    USING (
        child_id IN (SELECT public.my_child_ids())
        OR public.pot_administra_activitate(activity_id)
    );

CREATE OR REPLACE FUNCTION public.record_activity_attendance(
    p_activity_id UUID,
    p_child_ids UUID[],
    p_status TEXT,
    p_only_unmarked BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor UUID := (SELECT auth.uid());
    v_date DATE;
    v_child UUID;
    v_changed INTEGER := 0;
    v_rows INTEGER;
BEGIN
    IF v_actor IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_actor AND enabled
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_activity_id IS NULL
        OR coalesce(cardinality(p_child_ids), 0) NOT BETWEEN 1 AND 200
        OR (p_status IS NOT NULL AND p_status NOT IN ('PRESENT', 'ABSENT'))
        OR (p_only_unmarked AND p_status IS DISTINCT FROM 'PRESENT') THEN
        RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
    END IF;
    SELECT activity_date INTO v_date FROM public.activities WHERE id = p_activity_id FOR SHARE;
    IF NOT FOUND OR NOT public.pot_administra_activitate(p_activity_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_date > (now() AT TIME ZONE 'Europe/Bucharest')::DATE THEN
        RAISE EXCEPTION 'TOO_EARLY' USING ERRCODE = '22023';
    END IF;
    FOREACH v_child IN ARRAY p_child_ids LOOP
        IF v_child IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.enrollments
            WHERE kind = 'ACTIVITY' AND entity_id = p_activity_id
              AND child_id = v_child AND status = 'ACTIVE'
        ) THEN
            RAISE EXCEPTION 'NOT_ENROLLED' USING ERRCODE = '22023';
        END IF;
        IF p_status IS NULL THEN
            DELETE FROM public.activity_attendance
                WHERE activity_id = p_activity_id AND child_id = v_child;
        ELSIF p_only_unmarked THEN
            INSERT INTO public.activity_attendance (activity_id, child_id, status, recorded_by)
                VALUES (p_activity_id, v_child, p_status, v_actor)
                ON CONFLICT (activity_id, child_id) DO NOTHING;
        ELSE
            INSERT INTO public.activity_attendance (activity_id, child_id, status, recorded_by)
                VALUES (p_activity_id, v_child, p_status, v_actor)
                ON CONFLICT (activity_id, child_id) DO UPDATE
                SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by, recorded_at = now();
        END IF;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        v_changed := v_changed + v_rows;
    END LOOP;
    RETURN v_changed;
END;
$$;

REVOKE ALL ON FUNCTION public.record_activity_attendance(UUID, UUID[], TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_activity_attendance(UUID, UUID[], TEXT, BOOLEAN) TO authenticated;
