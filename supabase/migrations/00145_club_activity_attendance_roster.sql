-- Lista de pontaj a unei activități, pentru cine o administrează (funcționalitatea
-- TT #522, punctul 1: clubul pontează la activitățile lui).
--
-- `record_activity_attendance` (00100) acceptă deja clubul care deține
-- activitatea, dar clubul nu are de unde citi lista copiilor: `enrollments_select`
-- îi arată doar înscrierile la CURSURILE clubului, iar `children_select` doar
-- copiii acelor cursuri. 00128 a ales să nu lărgească politica pentru activități,
-- fiindcă rândurile de înscriere ar expune și adultul, prețul și plata.
--
-- Aceeași alegere și aici: politicile rămân neschimbate, iar funcția întoarce
-- strictul necesar pentru pontaj (copilul, numele, data nașterii și starea
-- pontajului), doar pentru înscrierile ACTIVE ale unei activități pe care
-- apelantul o poate administra (`pot_administra_activitate`: antrenorul ei,
-- proprietarul clubului ei sau ADMIN, cu cont activ). Altfel întoarce 42501.

CREATE FUNCTION public.activity_attendance_roster(p_activity_id UUID)
RETURNS TABLE (child_id UUID, child_name TEXT, child_birth_date DATE, status TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT auth.uid()) IS NULL OR p_activity_id IS NULL
        OR NOT public.pot_administra_activitate(p_activity_id) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
        SELECT c.id, c.name::TEXT, c.birth_date, aa.status::TEXT
        FROM public.enrollments e
        JOIN public.children c ON c.id = e.child_id
        LEFT JOIN public.activity_attendance aa
            ON aa.activity_id = e.entity_id AND aa.child_id = c.id
        WHERE e.kind = 'ACTIVITY' AND e.entity_id = p_activity_id AND e.status = 'ACTIVE'
        ORDER BY c.name, c.id;
END;
$$;

COMMENT ON FUNCTION public.activity_attendance_roster(UUID) IS
    'Copiii cu înscriere activă la o activitate și starea pontajului, pentru antrenorul ei, clubul ei sau ADMIN.';

REVOKE ALL ON FUNCTION public.activity_attendance_roster(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activity_attendance_roster(UUID) TO authenticated, service_role;
