CREATE OR REPLACE FUNCTION public.pot_administra_curs(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = p_course_id
          AND (
              c.club_id IN (SELECT my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$$;

REVOKE ALL ON FUNCTION public.pot_administra_curs(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pot_administra_curs(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.pot_administra_activitate(p_activity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.id = p_activity_id
          AND (
              a.club_id IN (SELECT my_club_ids())
              OR a.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$$;

REVOKE ALL ON FUNCTION public.pot_administra_activitate(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pot_administra_activitate(UUID) TO authenticated;

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS rules_file_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_name TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_content_type TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_size_bytes INTEGER;

ALTER TABLE public.courses
    DROP CONSTRAINT IF EXISTS courses_rules_file_ck;

ALTER TABLE public.courses
    ADD CONSTRAINT courses_rules_file_ck CHECK (
        (rules_file_storage_path IS NULL)
            = (rules_file_name IS NULL)
        AND (rules_file_storage_path IS NULL)
            = (rules_file_content_type IS NULL)
        AND (rules_file_storage_path IS NULL)
            = (rules_file_size_bytes IS NULL)
        AND (
            rules_file_storage_path IS NULL
            OR (
                char_length(rules_file_name) BETWEEN 1 AND 255
                AND rules_file_name !~ '[/\\]'
                AND rules_file_size_bytes BETWEEN 1 AND 10485760
                AND public.camp_rules_file_content_type_permis(rules_file_content_type)
                AND rules_file_storage_path ~ ('^' || id::text || '/[^/]+$')
            )
        )
    );

ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS rules_file_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_name TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_content_type TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_size_bytes INTEGER;

ALTER TABLE public.activities
    DROP CONSTRAINT IF EXISTS activities_rules_file_ck;

ALTER TABLE public.activities
    ADD CONSTRAINT activities_rules_file_ck CHECK (
        (rules_file_storage_path IS NULL)
            = (rules_file_name IS NULL)
        AND (rules_file_storage_path IS NULL)
            = (rules_file_content_type IS NULL)
        AND (rules_file_storage_path IS NULL)
            = (rules_file_size_bytes IS NULL)
        AND (
            rules_file_storage_path IS NULL
            OR (
                char_length(rules_file_name) BETWEEN 1 AND 255
                AND rules_file_name !~ '[/\\]'
                AND rules_file_size_bytes BETWEEN 1 AND 10485760
                AND public.camp_rules_file_content_type_permis(rules_file_content_type)
                AND rules_file_storage_path ~ ('^' || id::text || '/[^/]+$')
            )
        )
    );

CREATE OR REPLACE FUNCTION public.limiteaza_regulament_activitate_club()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    vechi JSONB := to_jsonb(OLD)
        - 'rules_file_storage_path'
        - 'rules_file_name'
        - 'rules_file_content_type'
        - 'rules_file_size_bytes';
    nou JSONB := to_jsonb(NEW)
        - 'rules_file_storage_path'
        - 'rules_file_name'
        - 'rules_file_content_type'
        - 'rules_file_size_bytes';
BEGIN
    IF (SELECT get_my_role()) IS DISTINCT FROM 'CLUB' THEN
        RETURN NEW;
    END IF;
    IF OLD.coach_id IS NOT DISTINCT FROM (SELECT auth.uid()) THEN
        RETURN NEW;
    END IF;
    IF vechi IS DISTINCT FROM nou THEN
        RAISE EXCEPTION 'Clubul poate schimba doar fișierul regulamentului.'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.limiteaza_regulament_activitate_club() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limiteaza_regulament_activitate_club() TO authenticated, service_role;

DROP TRIGGER IF EXISTS activities_club_rules_file ON public.activities;
CREATE TRIGGER activities_club_rules_file
    BEFORE UPDATE ON public.activities
    FOR EACH ROW
    EXECUTE FUNCTION public.limiteaza_regulament_activitate_club();

DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities
    FOR SELECT TO anon, authenticated
    USING (
        active = true
        OR coach_id = (SELECT auth.uid())
        OR club_id IN (SELECT public.my_club_ids())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

DROP POLICY IF EXISTS "activities_update" ON public.activities;
CREATE POLICY "activities_update" ON public.activities
    FOR UPDATE TO authenticated
    USING (
        coach_id = (SELECT auth.uid())
        OR club_id IN (SELECT public.my_club_ids())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    )
    WITH CHECK (
        coach_id = (SELECT auth.uid())
        OR club_id IN (SELECT public.my_club_ids())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'course-rules',
    'course-rules',
    true,
    10485760,
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'activity-rules',
    'activity-rules',
    true,
    10485760,
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "course_rules_owner_insert" ON storage.objects;
CREATE POLICY "course_rules_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'course-rules'
        AND public.pot_administra_curs(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

DROP POLICY IF EXISTS "course_rules_owner_delete" ON storage.objects;
CREATE POLICY "course_rules_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'course-rules'
        AND public.pot_administra_curs(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

DROP POLICY IF EXISTS "course_rules_owner_select" ON storage.objects;
CREATE POLICY "course_rules_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'course-rules'
        AND public.pot_administra_curs(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

DROP POLICY IF EXISTS "activity_rules_owner_insert" ON storage.objects;
CREATE POLICY "activity_rules_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'activity-rules'
        AND public.pot_administra_activitate(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

DROP POLICY IF EXISTS "activity_rules_owner_delete" ON storage.objects;
CREATE POLICY "activity_rules_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'activity-rules'
        AND public.pot_administra_activitate(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

DROP POLICY IF EXISTS "activity_rules_owner_select" ON storage.objects;
CREATE POLICY "activity_rules_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'activity-rules'
        AND public.pot_administra_activitate(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );
