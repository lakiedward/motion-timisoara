\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END;
$$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.camps (
    id UUID PRIMARY KEY,
    coach_id UUID,
    title TEXT,
    slug TEXT
);

CREATE FUNCTION public.pot_administra_tabara(p_camp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.camps c
        WHERE c.id = p_camp_id
          AND c.coach_id IS NOT DISTINCT FROM NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
    )
$$;
GRANT EXECUTE ON FUNCTION public.pot_administra_tabara(UUID) TO authenticated, anon;

CREATE FUNCTION public.safe_uuid(t TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    RETURN t::uuid;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.safe_uuid(TEXT) TO authenticated, anon;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public BOOLEAN,
    file_size_limit BIGINT,
    allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL,
    name TEXT NOT NULL
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON storage.buckets TO authenticated;

CREATE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    _parts TEXT[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[1:array_length(_parts, 1) - 1];
END;
$$;

\i /tmp/migrations/00065_camp_rules_file.sql

INSERT INTO public.camps(id, coach_id, title, slug)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'Tabără',
    'tabara'
);

UPDATE public.camps
SET rules_file_storage_path = '00000000-0000-0000-0000-000000000001/aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaa1.pdf',
    rules_file_name = 'regulament.pdf',
    rules_file_content_type = 'application/pdf',
    rules_file_size_bytes = 1200
WHERE id = '00000000-0000-0000-0000-000000000001';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE id = 'camp-rules' AND public IS TRUE AND file_size_limit = 10485760
    ) THEN
        RAISE EXCEPTION 'camp-rules bucket is missing public 10 MB limits';
    END IF;
END;
$$;

UPDATE public.camps SET title = 'Tabără actualizată'
WHERE id = '00000000-0000-0000-0000-000000000001';
DO $$
DECLARE
    v_path TEXT;
BEGIN
    SELECT rules_file_storage_path INTO v_path
    FROM public.camps WHERE id = '00000000-0000-0000-0000-000000000001';
    IF v_path IS DISTINCT FROM '00000000-0000-0000-0000-000000000001/aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaa1.pdf' THEN
        RAISE EXCEPTION 'Form-style update must leave the rules file in place';
    END IF;
END;
$$;

DO $$
BEGIN
    BEGIN
        UPDATE public.camps
        SET rules_file_content_type = 'video/mp4'
        WHERE id = '00000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'Video MIME must be rejected';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.camps
        SET rules_file_size_bytes = 10485761
        WHERE id = '00000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'Oversize file must be rejected';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.camps
        SET rules_file_name = NULL
        WHERE id = '00000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'Partial file metadata must be rejected';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        UPDATE public.camps
        SET rules_file_storage_path = '00000000-0000-0000-0000-000000000002/x.pdf'
        WHERE id = '00000000-0000-0000-0000-000000000001';
        RAISE EXCEPTION 'Path for another camp must be rejected';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END;
$$;

ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_camps ON public.camps FOR ALL TO authenticated
    USING (public.pot_administra_tabara(id))
    WITH CHECK (public.pot_administra_tabara(id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.camps TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000101';
INSERT INTO storage.objects(bucket_id, name)
VALUES (
    'camp-rules',
    '00000000-0000-0000-0000-000000000001/bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbb1.pdf'
);

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000202';
DO $$
BEGIN
    BEGIN
        INSERT INTO storage.objects(bucket_id, name)
        VALUES (
            'camp-rules',
            '00000000-0000-0000-0000-000000000001/ccccccc0-cccc-4ccc-8ccc-ccccccccccc1.pdf'
        );
        RAISE EXCEPTION 'Foreign organizer must not upload another camp rules file';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$$;

RESET ROLE;
ROLLBACK;
