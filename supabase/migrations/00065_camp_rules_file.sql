CREATE OR REPLACE FUNCTION public.camp_rules_file_content_type_permis(p_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_type IN (
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
$$;

REVOKE ALL ON FUNCTION public.camp_rules_file_content_type_permis(TEXT)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.camp_rules_file_content_type_permis(TEXT)
    TO authenticated, service_role;

ALTER TABLE public.camps
    ADD COLUMN IF NOT EXISTS rules_file_storage_path TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_name TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_content_type TEXT,
    ADD COLUMN IF NOT EXISTS rules_file_size_bytes INTEGER;

ALTER TABLE public.camps
    DROP CONSTRAINT IF EXISTS camps_rules_file_ck;

ALTER TABLE public.camps
    ADD CONSTRAINT camps_rules_file_ck CHECK (
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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'camp-rules',
    'camp-rules',
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

DROP POLICY IF EXISTS "camp_rules_owner_insert" ON storage.objects;
CREATE POLICY "camp_rules_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'camp-rules'
        AND public.pot_administra_tabara(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

DROP POLICY IF EXISTS "camp_rules_owner_delete" ON storage.objects;
CREATE POLICY "camp_rules_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'camp-rules'
        AND public.pot_administra_tabara(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

DROP POLICY IF EXISTS "camp_rules_owner_select" ON storage.objects;
CREATE POLICY "camp_rules_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'camp-rules'
        AND public.pot_administra_tabara(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );
