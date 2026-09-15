\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS net;
CREATE SCHEMA IF NOT EXISTS vault;
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::JSONB, '{}'::JSONB); $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::UUID; $$;
CREATE TABLE auth.sessions(id UUID PRIMARY KEY, user_id UUID NOT NULL, not_after TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS vault.decrypted_secrets(name TEXT, decrypted_secret TEXT);
CREATE TABLE public.test_network_calls(id BIGSERIAL PRIMARY KEY, url TEXT, headers JSONB);
CREATE FUNCTION net.http_post(url TEXT, headers JSONB, body JSONB, timeout_milliseconds INTEGER) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT;
BEGIN INSERT INTO public.test_network_calls(url, headers) VALUES (url, headers) RETURNING id INTO v_id; RETURN v_id; END;
$$;
CREATE TABLE cron.job(jobid BIGSERIAL PRIMARY KEY, jobname TEXT, schedule TEXT, command TEXT);
CREATE FUNCTION cron.schedule(job_name TEXT, schedule TEXT, command TEXT) RETURNS BIGINT LANGUAGE sql AS $$
    INSERT INTO cron.job(jobname, schedule, command) VALUES (job_name, schedule, command) RETURNING jobid;
$$;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID REFERENCES public.profiles);
CREATE TABLE public.courses(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), club_id UUID REFERENCES public.clubs, active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE public.activities(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), club_id UUID REFERENCES public.clubs);
CREATE TABLE public.camps(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), club_id UUID REFERENCES public.clubs, slug TEXT NOT NULL, period_end DATE NOT NULL);
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), child_id UUID REFERENCES public.children, kind TEXT NOT NULL, entity_id UUID NOT NULL, status TEXT NOT NULL);
CREATE TABLE public.course_occurrences(id UUID PRIMARY KEY, course_id UUID REFERENCES public.courses ON DELETE CASCADE);
CREATE TABLE public.attendance(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), occurrence_id UUID REFERENCES public.course_occurrences ON DELETE CASCADE, child_id UUID REFERENCES public.children, status TEXT NOT NULL, note TEXT, UNIQUE(occurrence_id, child_id));
CREATE TABLE public.course_announcements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID REFERENCES public.courses ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), content TEXT, pinned BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE public.club_announcements(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), club_id UUID REFERENCES public.clubs, audience_kind TEXT NOT NULL DEFAULT 'CLUB', audience_id UUID, is_active BOOLEAN NOT NULL DEFAULT true, publish_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), title TEXT, content TEXT);
CREATE FUNCTION public.audience_club_id(p_kind TEXT, p_id UUID) RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT CASE p_kind WHEN 'COURSE' THEN (SELECT club_id FROM public.courses WHERE id = p_id)
        WHEN 'ACTIVITY' THEN (SELECT club_id FROM public.activities WHERE id = p_id)
        WHEN 'CAMP' THEN (SELECT club_id FROM public.camps WHERE id = p_id) END;
$$;
CREATE TABLE public.test_results(label TEXT);
CREATE FUNCTION public.test_uuid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-4000-8000-' || lpad(n::TEXT,12,'0'))::UUID; $$;
CREATE FUNCTION public.test_actor(n INTEGER, session INTEGER DEFAULT NULL) RETURNS VOID LANGUAGE sql AS $$
    SELECT set_config('request.jwt.claims', jsonb_build_object('sub', public.test_uuid(n), 'role', 'authenticated', 'session_id', public.test_uuid(COALESCE(session,n+100)))::TEXT, false);
$$;
CREATE FUNCTION public.test_assert(value BOOLEAN, label TEXT) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', label; END IF; INSERT INTO public.test_results VALUES(label); END; $$;
CREATE FUNCTION public.test_denied(statement TEXT, label TEXT) RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN PERFORM public.test_assert(true,label); RETURN; END;
    RAISE EXCEPTION 'Expected denial: %',label;
END; $$;
INSERT INTO public.profiles VALUES(public.test_uuid(1),'PARENT',true),(public.test_uuid(2),'PARENT',true),(public.test_uuid(3),'PARENT',true),(public.test_uuid(4),'PARENT',true),(public.test_uuid(5),'COACH',true),(public.test_uuid(6),'PARENT',false);
INSERT INTO auth.sessions SELECT public.test_uuid(n+100), public.test_uuid(n), NULL FROM generate_series(1,6) n;
INSERT INTO public.clubs VALUES(public.test_uuid(10),public.test_uuid(5)),(public.test_uuid(20),public.test_uuid(5));
INSERT INTO public.courses VALUES(public.test_uuid(11),public.test_uuid(10),true),(public.test_uuid(21),public.test_uuid(20),true),(public.test_uuid(12),public.test_uuid(10),false);
INSERT INTO public.camps VALUES(public.test_uuid(13),public.test_uuid(10),'tabara-vara',current_date+10);
INSERT INTO public.activities VALUES(public.test_uuid(14),public.test_uuid(10));
INSERT INTO public.children VALUES(public.test_uuid(31),public.test_uuid(1)),(public.test_uuid(32),public.test_uuid(2)),(public.test_uuid(33),public.test_uuid(3)),(public.test_uuid(34),public.test_uuid(1)),(public.test_uuid(35),public.test_uuid(4));
INSERT INTO public.enrollments(child_id,kind,entity_id,status) VALUES
    (public.test_uuid(31),'COURSE',public.test_uuid(11),'ACTIVE'),(public.test_uuid(34),'COURSE',public.test_uuid(11),'ACTIVE'),
    (public.test_uuid(32),'COURSE',public.test_uuid(21),'ACTIVE'),(public.test_uuid(33),'CAMP',public.test_uuid(13),'ACTIVE'),
    (public.test_uuid(35),'COURSE',public.test_uuid(11),'PENDING');
INSERT INTO public.course_occurrences VALUES(public.test_uuid(40),public.test_uuid(11));
INSERT INTO public.course_announcements(id,course_id) VALUES(public.test_uuid(50),public.test_uuid(11));
\i /tmp/00057_android_parent_push.sql
