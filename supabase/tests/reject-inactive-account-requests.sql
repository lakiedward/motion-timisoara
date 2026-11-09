\set ON_ERROR_STOP on
BEGIN;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
$$;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles OWNER TO postgres;
GRANT USAGE, CREATE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
INSERT INTO public.profiles(id, role, enabled, deleted_at) VALUES
    ('00000000-0000-0000-0000-000000000001', 'COACH', true, NULL),
    ('00000000-0000-0000-0000-000000000002', 'COACH', false, NULL),
    ('00000000-0000-0000-0000-000000000003', 'PARENT', false, now()),
    ('00000000-0000-0000-0000-000000000004', 'CLUB', true, now());

SELECT set_config('migration.sql', pg_read_file('/tmp/migrations/00134_reject_inactive_account_requests.sql'), true) IS NOT NULL AS migration_loaded;
DO $$
BEGIN
    EXECUTE 'SET LOCAL ROLE postgres';
    EXECUTE current_setting('migration.sql');
    EXECUTE 'RESET ROLE';
END
$$;

DO $$
DECLARE
    v_case RECORD;
    v_result TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole
        WHERE r.rolname = 'authenticator'
          AND 'pgrst.db_pre_request=public.reject_inactive_account' = ANY (s.setconfig)
    ) THEN
        RAISE EXCEPTION 'authenticator nu are pgrst.db_pre_request setat.';
    END IF;
    IF has_function_privilege('public', 'public.reject_inactive_account()', 'EXECUTE') THEN
        RAISE EXCEPTION 'PUBLIC nu trebuie să poată executa funcția direct.';
    END IF;

    FOR v_case IN
        SELECT * FROM (VALUES
            ('anon', 'anon', '{"role":"anon"}', 'ok'),
            ('service_role', 'service_role', '{"role":"service_role"}', 'ok'),
            ('activ', 'authenticated', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}', 'ok'),
            ('dezactivat', 'authenticated', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000002"}', 'account_disabled'),
            ('sters', 'authenticated', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000003"}', 'account_deleted'),
            ('sters-activ', 'authenticated', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000004"}', 'account_deleted'),
            ('fara-profil', 'authenticated', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000009"}', 'ok')
        ) AS t(actor, db_role, claims, expected)
    LOOP
        PERFORM set_config('request.jwt.claims', v_case.claims, true);
        EXECUTE format('SET LOCAL ROLE %I', v_case.db_role);
        BEGIN
            PERFORM public.reject_inactive_account();
            v_result := 'ok';
        EXCEPTION WHEN SQLSTATE 'PGRST' THEN
            v_result := SQLERRM::jsonb ->> 'code';
        END;
        EXECUTE 'RESET ROLE';
        IF v_result IS DISTINCT FROM v_case.expected THEN
            RAISE EXCEPTION 'Rezultat greșit pentru %: % (așteptat %)', v_case.actor, v_result, v_case.expected;
        END IF;
    END LOOP;
END
$$;

DO $$
DECLARE
    v_status TEXT;
BEGIN
    PERFORM set_config('request.jwt.claims',
        '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000002"}', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        PERFORM public.reject_inactive_account();
    EXCEPTION WHEN SQLSTATE 'PGRST' THEN
        GET STACKED DIAGNOSTICS v_status = PG_EXCEPTION_DETAIL;
    END;
    EXECUTE 'RESET ROLE';
    IF (v_status::jsonb ->> 'status') IS DISTINCT FROM '403' THEN
        RAISE EXCEPTION 'Statusul HTTP trebuie să fie 403, nu %.', v_status;
    END IF;
END
$$;

DO $$
BEGIN
    BEGIN
        EXECUTE 'SET LOCAL ROLE postgres';
        EXECUTE current_setting('migration.sql');
        RAISE EXCEPTION 'guard-missed';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'guard-missed' THEN
            RAISE EXCEPTION 'Migrația 00134 trebuie să refuze un db_pre_request existent.';
        END IF;
    END;
    EXECUTE 'RESET ROLE';
END
$$;

ROLLBACK;
\echo 'reject inactive account requests: ok'
