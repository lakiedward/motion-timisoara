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
-- proprietarul clubului ei sau ADMIN, cu cont activ). Un cont CLUB citește lista
-- doar dacă clubul e aprobat, ca la cursuri (00144). Altfel întoarce 42501.

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
    IF (SELECT public.get_my_role()) = 'CLUB' AND NOT EXISTS (
        SELECT 1 FROM public.activities a
        JOIN public.clubs cl ON cl.id = a.club_id
        WHERE a.id = p_activity_id AND cl.approved_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
        SELECT c.id, c.name::TEXT, c.birth_date, aa.status::TEXT
        FROM public.children c
        LEFT JOIN public.activity_attendance aa
            ON aa.activity_id = p_activity_id AND aa.child_id = c.id
        WHERE EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.kind = 'ACTIVITY' AND e.entity_id = p_activity_id
              AND e.child_id = c.id AND e.status = 'ACTIVE'
        )
        ORDER BY c.name, c.id;
END;
$$;

COMMENT ON FUNCTION public.activity_attendance_roster(UUID) IS
    'Copiii cu înscriere activă la o activitate și starea pontajului, pentru antrenorul ei, clubul ei sau ADMIN.';

REVOKE ALL ON FUNCTION public.activity_attendance_roster(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activity_attendance_roster(UUID) TO authenticated, service_role;
