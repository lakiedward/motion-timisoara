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

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE TABLE public.profiles (id UUID PRIMARY KEY, role TEXT NOT NULL);
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Club',
    approved_at TIMESTAMPTZ
);
CREATE TABLE public.coach_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE TABLE public.club_coaches (
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (club_id, coach_profile_id)
);
CREATE TABLE public.children (id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles(id));
CREATE TABLE public.courses (id UUID PRIMARY KEY, club_id UUID REFERENCES public.clubs(id), coach_id UUID REFERENCES public.profiles(id), active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE public.camps (id UUID PRIMARY KEY, club_id UUID REFERENCES public.clubs(id), coach_id UUID REFERENCES public.profiles(id));
CREATE TABLE public.activities (id UUID PRIMARY KEY, club_id UUID REFERENCES public.clubs(id), coach_id UUID REFERENCES public.profiles(id), active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE public.competitions (id UUID PRIMARY KEY, club_id UUID REFERENCES public.clubs(id), coach_id UUID REFERENCES public.profiles(id));
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind TEXT NOT NULL CHECK (kind IN ('COURSE', 'CAMP', 'ACTIVITY', 'COMPETITION')),
    entity_id UUID NOT NULL,
    child_id UUID REFERENCES public.children(id),
    adult_profile_id UUID REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
CREATE FUNCTION public.my_club_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid()
$$;
CREATE FUNCTION public.my_children_course_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT e.entity_id FROM public.enrollments e
    JOIN public.children c ON c.id = e.child_id
    WHERE e.kind = 'COURSE' AND c.parent_id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role(), public.my_club_ids(), public.my_children_course_ids() TO anon, authenticated;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.courses, public.camps, public.activities, public.competitions, public.clubs,
    public.coach_profiles, public.club_coaches TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
CREATE POLICY courses_select ON public.courses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY camps_select ON public.camps FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY activities_select ON public.activities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY competitions_select ON public.competitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY clubs_select ON public.clubs FOR SELECT TO authenticated USING (true);
CREATE POLICY clubs_select_anon ON public.clubs FOR SELECT TO anon USING (approved_at IS NOT NULL);
CREATE POLICY coach_profiles_select ON public.coach_profiles FOR SELECT TO anon, authenticated USING (true);

-- Accounts. c1 independent coach, c2 independent coach (pays), c3 coach only in club e1,
-- d1 owns club e1 (expires), d2 owns club e2 (paid), b1 parent with an enrollment, b2 parent without.
INSERT INTO public.profiles (id, role) VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'ADMIN'),
    ('00000000-0000-0000-0000-0000000000b1', 'PARENT'),
    ('00000000-0000-0000-0000-0000000000b2', 'PARENT'),
    ('00000000-0000-0000-0000-0000000000c1', 'COACH'),
    ('00000000-0000-0000-0000-0000000000c2', 'COACH'),
    ('00000000-0000-0000-0000-0000000000c3', 'COACH'),
    ('00000000-0000-0000-0000-0000000000d1', 'CLUB'),
    ('00000000-0000-0000-0000-0000000000d2', 'CLUB'),
    ('00000000-0000-0000-0000-0000000000d3', 'CLUB');
INSERT INTO public.clubs (id, owner_user_id, approved_at) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', now()),
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', now()),
    ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d3', NULL);
INSERT INTO public.coach_profiles (id, user_id) VALUES
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000c2'),
    ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000c3');
INSERT INTO public.club_coaches (club_id, coach_profile_id) VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f3');
INSERT INTO public.children (id, parent_id) VALUES
    ('00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-0000000000b1');
-- Offers: 1x = c1 own, 2x = c2 own, 3x = club e1, 4x = club e2, 5x = no owner.
INSERT INTO public.courses (id, club_id, coach_id) VALUES
    ('00000000-0000-0000-0000-000000000011', NULL, '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-000000000021', NULL, '00000000-0000-0000-0000-0000000000c2'),
    ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c3'),
    ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-0000000000e2', NULL);
INSERT INTO public.camps (id, club_id, coach_id) VALUES
    ('00000000-0000-0000-0000-000000000012', NULL, '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-0000000000e1', NULL),
    ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-0000000000e2', NULL);
INSERT INTO public.activities (id, club_id, coach_id) VALUES
    ('00000000-0000-0000-0000-000000000013', NULL, '00000000-0000-0000-0000-0000000000c1'),
    ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-0000000000e2', NULL);
INSERT INTO public.competitions (id, club_id, coach_id) VALUES
    ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-0000000000e1', NULL),
    ('00000000-0000-0000-0000-000000000054', NULL, NULL);
INSERT INTO public.enrollments (kind, entity_id, child_id, status) VALUES
    ('CAMP', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-00000000c0b1', 'ACTIVE');

-- Production grants and policies on club_coaches and coach_profiles before 00123 (from 00011).
ALTER TABLE public.club_coaches ENABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE, DELETE ON public.club_coaches TO anon, authenticated;
GRANT INSERT ON public.coach_profiles TO authenticated;
CREATE POLICY club_coaches_select ON public.club_coaches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY club_coaches_insert ON public.club_coaches FOR INSERT TO authenticated
    WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (SELECT public.get_my_role()) = 'ADMIN');
CREATE POLICY club_coaches_update ON public.club_coaches FOR UPDATE TO authenticated
    USING (club_id IN (SELECT public.my_club_ids()) OR (SELECT public.get_my_role()) = 'ADMIN')
    WITH CHECK (club_id IN (SELECT public.my_club_ids()) OR (SELECT public.get_my_role()) = 'ADMIN');
CREATE POLICY club_coaches_delete ON public.club_coaches FOR DELETE TO authenticated
    USING (club_id IN (SELECT public.my_club_ids()) OR (SELECT public.get_my_role()) = 'ADMIN');
CREATE POLICY coach_profiles_insert ON public.coach_profiles FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'ADMIN');

\i /tmp/migrations/00107_subscriptions.sql
\i /tmp/migrations/00116_subscription_access_rules.sql
\i /tmp/migrations/00117_club_coach_limit.sql
\i /tmp/migrations/00118_subscription_trials.sql

CREATE FUNCTION pg_temp.expect(p_ok boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', p_message; END IF;
END;
$$;
CREATE FUNCTION pg_temp.attempt(p_role text, p_user text, p_sql text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    v_state text := 'ok';
    v_message text;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user, ''), true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
        v_state := v_state || ':' || v_message;
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    RETURN v_state;
END;
$$;
CREATE FUNCTION pg_temp.value(p_role text, p_user text, p_sql text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    v_value text;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user, ''), true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    EXECUTE p_sql INTO v_value;
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    RETURN v_value;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.attempt(text, text, text), pg_temp.value(text, text, text) TO anon, authenticated;

-- After launch: e2 pays Club Start (3 coaches) and already has 3; d2 also owns e4, unapproved.
UPDATE public.subscription_settings SET launch_at = now() - interval '100 days';
UPDATE public.subscriptions SET status = 'active', plan_code = 'CLUB_START', current_period_end = now() + interval '20 days'
    WHERE club_id = '00000000-0000-0000-0000-0000000000e2';
UPDATE public.subscriptions SET status = 'active', plan_code = 'CLUB', current_period_end = now() + interval '20 days'
    WHERE club_id = '00000000-0000-0000-0000-0000000000e1';
INSERT INTO public.clubs (id, owner_user_id, approved_at) VALUES
    ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000d2', NULL);
INSERT INTO public.profiles (id, role)
    SELECT ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'COACH' FROM generate_series(1, 8) i;
INSERT INTO public.coach_profiles (id, user_id)
    SELECT ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid,
           ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid FROM generate_series(1, 8) i;
INSERT INTO public.club_coaches (club_id, coach_profile_id)
    SELECT '00000000-0000-0000-0000-0000000000e2', ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid
    FROM generate_series(1, 3) i;

-- BEFORE 00123: the reported holes are real.
DO $$
DECLARE
    d2 CONSTANT text := '00000000-0000-0000-0000-0000000000d2';
BEGIN
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', d2, $q$INSERT INTO public.club_coaches (club_id, coach_profile_id)
        VALUES ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000204')$q$) = 'ok',
        'before #1338: the owner adds a coach to an unapproved club without a limit');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', d2, $q$UPDATE public.club_coaches
        SET club_id = '00000000-0000-0000-0000-0000000000e2' WHERE club_id = '00000000-0000-0000-0000-0000000000e4'$q$) = 'ok',
        'before #1338: the owner moves that coach into the full Club Start club');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.club_coaches WHERE club_id = '00000000-0000-0000-0000-0000000000e2') = 4,
        'before #1338: Club Start ends with 4 coaches');
    DELETE FROM public.club_coaches WHERE club_id = '00000000-0000-0000-0000-0000000000e2'
        AND coach_profile_id = '00000000-0000-0000-0000-000000000204';

    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', '00000000-0000-0000-0000-0000000000b2', $q$INSERT INTO public.coach_profiles (id, user_id)
        VALUES ('00000000-0000-0000-0000-0000000002b2', '00000000-0000-0000-0000-0000000000b2')$q$) = 'ok',
        'before #1341: a parent creates their own coach profile');
    PERFORM pg_temp.expect(EXISTS (SELECT 1 FROM public.subscriptions WHERE coach_user_id = '00000000-0000-0000-0000-0000000000b2'),
        'before #1341: the parent gets a COACH subscription row');

    PERFORM pg_temp.expect(pg_temp.value('anon', NULL,
        $q$SELECT public.subscriber_has_access('00000000-0000-0000-0000-0000000000e2', NULL)::text$q$) = 'true',
        'before #1342: anon learns that club e2 has paid');
    PERFORM pg_temp.expect(public.club_coach_capacity('00000000-0000-0000-0000-0000000000e3', NULL)->>'coachLimit' IS NULL,
        'before #1339: a club without a plan has no limit');
END;
$$;

\i /tmp/migrations/00123_subscription_security_fixes.sql

-- AFTER 00123, #1338: no direct writes, DELETE kept, the trigger also guards a move.
DO $$
DECLARE
    d2 CONSTANT text := '00000000-0000-0000-0000-0000000000d2';
BEGIN
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', d2, $q$INSERT INTO public.club_coaches (club_id, coach_profile_id)
        VALUES ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000204')$q$) LIKE '42501:%',
        'after #1338: a club owner cannot insert club_coaches');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', d2, $q$UPDATE public.club_coaches
        SET club_id = '00000000-0000-0000-0000-0000000000e4' WHERE club_id = '00000000-0000-0000-0000-0000000000e2'$q$) LIKE '42501:%',
        'after #1338: a club owner cannot update club_coaches');
    PERFORM pg_temp.expect(pg_temp.attempt('anon', NULL, $q$INSERT INTO public.club_coaches (club_id, coach_profile_id)
        VALUES ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000204')$q$) LIKE '42501:%',
        'after #1338: anon cannot insert club_coaches');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', d2, $q$DELETE FROM public.club_coaches
        WHERE club_id = '00000000-0000-0000-0000-0000000000e2' AND coach_profile_id = '00000000-0000-0000-0000-000000000203'$q$) = 'ok',
        'after #1338: the owner can still remove a coach');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.club_coaches WHERE club_id = '00000000-0000-0000-0000-0000000000e2') = 2,
        'after #1338: the removal took effect');
    INSERT INTO public.club_coaches (club_id, coach_profile_id) VALUES
        ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000203'),
        ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000204');
    PERFORM pg_temp.expect(pg_temp.attempt('postgres', NULL, $q$UPDATE public.club_coaches
        SET club_id = '00000000-0000-0000-0000-0000000000e2' WHERE club_id = '00000000-0000-0000-0000-0000000000e4'$q$)
        LIKE '23514:COACH_LIMIT_REACHED',
        'after #1338: even a privileged move into a full club is refused');
    PERFORM pg_temp.expect(pg_temp.attempt('postgres', NULL, $q$UPDATE public.club_coaches
        SET coach_profile_id = '00000000-0000-0000-0000-000000000205'
        WHERE club_id = '00000000-0000-0000-0000-0000000000e2' AND coach_profile_id = '00000000-0000-0000-0000-000000000203'$q$) = 'ok',
        'after #1338: replacing a coach inside the same club is not an addition');
END;
$$;

-- AFTER 00123, #1339: an open Checkout holds the chosen plan's limit until it expires.
DO $$
DECLARE
    e3 CONSTANT uuid := '00000000-0000-0000-0000-0000000000e3';
BEGIN
    UPDATE public.clubs SET approved_at = now() WHERE id = e3;
    PERFORM pg_temp.expect(public.hold_club_checkout_plan(e3, 'CLUB_START', now() + interval '45 minutes') = 0,
        'the hold returns the current coach count');
    PERFORM pg_temp.expect((SELECT checkout_plan_code = 'CLUB_START' FROM public.subscriptions WHERE club_id = e3),
        'the hold is stored on the club row');
    INSERT INTO public.club_coaches (club_id, coach_profile_id)
        SELECT e3, ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid FROM generate_series(6, 8) i;
    PERFORM pg_temp.expect(pg_temp.attempt('postgres', NULL, $q$INSERT INTO public.club_coaches (club_id, coach_profile_id)
        VALUES ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1')$q$) LIKE '23514:COACH_LIMIT_REACHED',
        'during the open Checkout the 4th coach is refused');
    PERFORM pg_temp.expect(public.hold_club_checkout_plan(e3, 'CLUB_PRO', now() + interval '45 minutes') = 3,
        'switching to Pro replaces the hold');
    INSERT INTO public.club_coaches (club_id, coach_profile_id)
        VALUES (e3, '00000000-0000-0000-0000-0000000000f1'), (e3, '00000000-0000-0000-0000-0000000000f2');
    PERFORM pg_temp.expect(public.hold_club_checkout_plan(e3, 'CLUB_START', now() + interval '45 minutes') = 5,
        'a plan below the coach count is reported');
    PERFORM pg_temp.expect((SELECT checkout_plan_code = 'CLUB_PRO' FROM public.subscriptions WHERE club_id = e3),
        'a plan below the coach count does not replace the hold');
    UPDATE public.subscriptions SET checkout_plan_code = 'CLUB_START', checkout_expires_at = now() - interval '1 minute'
        WHERE club_id = e3;
    PERFORM pg_temp.expect(public.club_coach_capacity(e3, NULL)->>'coachLimit' IS NULL,
        'an expired hold no longer limits the club');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', '00000000-0000-0000-0000-0000000000d3',
        $q$SELECT public.hold_club_checkout_plan('00000000-0000-0000-0000-0000000000e3', 'CLUB_PRO', now())$q$) LIKE '42501:%',
        'only service_role can set a hold');
    PERFORM pg_temp.expect(pg_temp.attempt('postgres', NULL,
        $q$UPDATE public.subscriptions SET checkout_plan_code = 'COACH', checkout_expires_at = now() WHERE club_id = '00000000-0000-0000-0000-0000000000e3'$q$)
        LIKE '23503:%', 'a club hold must be a club plan');
END;
$$;

-- AFTER 00123, #1341: only COACH accounts get a COACH row; promotion creates it; the parent row is removed.
DO $$
BEGIN
    PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE coach_user_id = '00000000-0000-0000-0000-0000000000b2'),
        'the parent COACH row without Stripe was removed');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', '00000000-0000-0000-0000-0000000000b1', $q$INSERT INTO public.coach_profiles (id, user_id)
        VALUES ('00000000-0000-0000-0000-0000000002b1', '00000000-0000-0000-0000-0000000000b1')$q$) LIKE '42501:%',
        'a parent can no longer create their own coach profile');
    INSERT INTO public.coach_profiles (id, user_id) VALUES ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-0000000000a1');
    PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE coach_user_id = '00000000-0000-0000-0000-0000000000a1'),
        'a coach profile for an ADMIN creates no COACH row');
    UPDATE public.profiles SET role = 'COACH' WHERE id = '00000000-0000-0000-0000-0000000000b2';
    PERFORM pg_temp.expect((SELECT status = 'trialing' AND trial_end > now() + interval '29 days'
        FROM public.subscriptions WHERE coach_user_id = '00000000-0000-0000-0000-0000000000b2'),
        'promoting an account that has a coach profile creates its trial row');
    INSERT INTO public.profiles (id, role) VALUES ('00000000-0000-0000-0000-0000000001c9', 'PARENT');
    UPDATE public.profiles SET role = 'COACH' WHERE id = '00000000-0000-0000-0000-0000000001c9';
    INSERT INTO public.coach_profiles (id, user_id) VALUES ('00000000-0000-0000-0000-0000000002c9', '00000000-0000-0000-0000-0000000001c9');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscriptions WHERE coach_user_id = '00000000-0000-0000-0000-0000000001c9') = 1,
        'the invitation order (role first, then profile) still creates exactly one row');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', '00000000-0000-0000-0000-000000000108', $q$INSERT INTO public.coach_profiles (id, user_id)
        VALUES ('00000000-0000-0000-0000-0000000002d8', '00000000-0000-0000-0000-000000000108')$q$) LIKE '23505:%',
        'a COACH still passes the insert policy (stopped only by the unique profile)');
END;
$$;

-- AFTER 00123, #1342: anon cannot ask; coaches ask only for their own clubs; listings still work.
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.attempt('anon', NULL,
        $q$SELECT public.subscriber_has_access('00000000-0000-0000-0000-0000000000e2', NULL)$q$) LIKE '42501:%', 'anon: subscriber_has_access refused');
    PERFORM pg_temp.expect(pg_temp.attempt('anon', NULL,
        $q$SELECT public.coach_has_access('00000000-0000-0000-0000-0000000000c2')$q$) LIKE '42501:%', 'anon: coach_has_access refused');
    PERFORM pg_temp.expect(pg_temp.attempt('anon', NULL,
        $q$SELECT public.offer_has_access('00000000-0000-0000-0000-0000000000e2', NULL)$q$) LIKE '42501:%', 'anon: offer_has_access refused');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', '00000000-0000-0000-0000-0000000000b2',
        $q$SELECT public.coach_has_access('00000000-0000-0000-0000-0000000000c2')$q$) LIKE '42501:%', 'signed in: coach_has_access refused');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', '00000000-0000-0000-0000-0000000000b2',
        $q$SELECT public.offer_has_access('00000000-0000-0000-0000-0000000000e2', NULL)$q$) LIKE '42501:%', 'signed in: offer_has_access refused');
    PERFORM pg_temp.expect(pg_temp.attempt('anon', NULL, $q$SELECT public.my_covering_club_ids()$q$) LIKE '42501:%',
        'anon: my_covering_club_ids refused');
    PERFORM pg_temp.expect(pg_temp.value('authenticated', '00000000-0000-0000-0000-0000000000c3',
        $q$SELECT string_agg(id::text, ',') FROM public.my_covering_club_ids() id$q$) = '00000000-0000-0000-0000-0000000000e1',
        'coach c3 sees only club e1, which covers them');
    PERFORM pg_temp.expect(pg_temp.value('authenticated', '00000000-0000-0000-0000-0000000001c9',
        $q$SELECT count(*)::text FROM public.my_covering_club_ids()$q$) = '0', 'a coach in no club gets nothing');
    UPDATE public.subscriptions SET status = 'expired', plan_code = NULL, current_period_end = NULL
        WHERE club_id = '00000000-0000-0000-0000-0000000000e1';
    PERFORM pg_temp.expect(pg_temp.value('authenticated', '00000000-0000-0000-0000-0000000000c3',
        $q$SELECT count(*)::text FROM public.my_covering_club_ids()$q$) = '0', 'an expired club no longer covers its coach');
    UPDATE public.subscriptions SET status = 'active', plan_code = 'CLUB', current_period_end = now() + interval '20 days'
        WHERE club_id = '00000000-0000-0000-0000-0000000000e1';
    PERFORM pg_temp.expect(pg_temp.value('anon', NULL, $q$SELECT count(*)::text FROM public.clubs$q$) = '3',
        'anon listings still use the access rules (e1, e2, e3)');
    PERFORM pg_temp.expect(pg_temp.value('anon', NULL, $q$SELECT count(*)::text FROM public.courses$q$) = '2',
        'anon course listing still works through offer_listed (e1 and e2 courses)');
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', '00000000-0000-0000-0000-0000000000b2',
        $q$SELECT public.subscriber_has_access('00000000-0000-0000-0000-0000000000e2', NULL)$q$) = 'ok',
        'until 00125, signed-in users keep subscriber_has_access for the published coach page');
END;
$$;

\i /tmp/migrations/00125_revoke_subscriber_access_rpc.sql

DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.attempt('authenticated', '00000000-0000-0000-0000-0000000000b2',
        $q$SELECT public.subscriber_has_access('00000000-0000-0000-0000-0000000000e2', NULL)$q$) LIKE '42501:%',
        'after 00125: signed in subscriber_has_access refused');
    PERFORM pg_temp.expect(pg_temp.value('authenticated', '00000000-0000-0000-0000-0000000000c3',
        $q$SELECT count(*)::text FROM public.my_covering_club_ids()$q$) = '1', 'after 00125: my_covering_club_ids still works');
    PERFORM pg_temp.expect(pg_temp.value('anon', NULL, $q$SELECT count(*)::text FROM public.clubs$q$) = '3',
        'after 00125: anon listings still work');
END;
$$;

ROLLBACK;
\echo 'subscription security fixes: all assertions passed'
