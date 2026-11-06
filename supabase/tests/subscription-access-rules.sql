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

\i /tmp/migrations/00107_subscriptions.sql
\i /tmp/migrations/00116_subscription_access_rules.sql
\i /tmp/migrations/00117_club_coach_limit.sql
\i /tmp/migrations/00118_subscription_trials.sql
\i /tmp/migrations/00123_subscription_security_fixes.sql

CREATE FUNCTION pg_temp.expect(p_ok boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %', p_message; END IF;
END;
$$;
CREATE FUNCTION pg_temp.refusal(p_sql text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
    v_message text;
    v_detail text;
BEGIN
    BEGIN
        EXECUTE p_sql;
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
        RETURN v_message || '|' || COALESCE(v_detail, '');
    END;
    RETURN NULL;
END;
$$;
CREATE FUNCTION pg_temp.visible(p_role text, p_user text, p_sql text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
    v_count bigint;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user, ''), true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    EXECUTE p_sql INTO v_count;
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.visible(text, text, text) TO anon, authenticated;

-- #616 backfill: one launch-promotion row per coach profile and approved club, none for e3.
DO $$
BEGIN
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscriptions) = 5, 'three coaches and two approved clubs');
    PERFORM pg_temp.expect((SELECT bool_and(status = 'trialing' AND trial_end IS NULL AND plan_code IS NULL)
                            FROM public.subscriptions), 'backfill rows are launch-promotion trials');
    PERFORM pg_temp.expect(NOT EXISTS (SELECT 1 FROM public.subscriptions
                            WHERE club_id = '00000000-0000-0000-0000-0000000000e3'), 'unapproved club has no row');
END;
$$;

-- launch_at NULL: nothing changes for anybody.
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, 'SELECT count(*) FROM public.courses') = 4, 'anon sees all courses before launch');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, 'SELECT count(*) FROM public.camps') = 3, 'anon sees all camps before launch');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, 'SELECT count(*) FROM public.clubs') = 2, 'anon sees approved clubs before launch');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, 'SELECT count(*) FROM public.coach_profiles') = 3, 'anon sees all coaches before launch');
    PERFORM pg_temp.expect(public.enrollment_offer_has_access('COURSE', '00000000-0000-0000-0000-000000000011'), 'enrollment allowed before launch');
END;
$$;
INSERT INTO public.enrollments (kind, entity_id, child_id) VALUES
    ('COURSE', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-00000000c0b1');

-- Launch 100 days ago: the promotion (90 days) has ended. c2 and e2 pay, c1 and e1 expired,
-- c3 has no access of their own and is covered only by e1 (expired).
UPDATE public.subscription_settings SET launch_at = now() - interval '100 days';
UPDATE public.subscriptions SET status = 'active', plan_code = 'COACH', current_period_end = now() + interval '20 days'
    WHERE coach_user_id = '00000000-0000-0000-0000-0000000000c2';
UPDATE public.subscriptions SET status = 'active', plan_code = 'CLUB_START', current_period_end = now() + interval '20 days'
    WHERE club_id = '00000000-0000-0000-0000-0000000000e2';

DO $$
DECLARE
    v_anon CONSTANT text := 'SELECT count(*) FROM public.%s';
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, format(v_anon, 'courses')) = 2, 'anon: only courses of c2 and e2');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, format(v_anon, 'camps')) = 1, 'anon: only the e2 camp');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, format(v_anon, 'activities')) = 1, 'anon: only the e2 activity');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, format(v_anon, 'competitions')) = 1, 'anon: only the ownerless competition');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, format(v_anon, 'clubs')) = 1, 'anon: only club e2');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, format(v_anon, 'coach_profiles')) = 1, 'anon: only coach c2');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000b2', format(v_anon, 'courses')) = 2,
        'a parent without enrollments sees what anon sees');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000b2', format(v_anon, 'clubs')) = 1,
        'a parent without enrollments sees only club e2');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000b1',
        'SELECT count(*) FROM public.camps WHERE id = ''00000000-0000-0000-0000-000000000032''') = 1,
        'the enrolled parent keeps the expired club camp');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000b1',
        'SELECT count(*) FROM public.courses WHERE id = ''00000000-0000-0000-0000-000000000011''') = 1,
        'the enrolled parent keeps the expired coach course');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000b1',
        'SELECT count(*) FROM public.clubs WHERE id = ''00000000-0000-0000-0000-0000000000e1''') = 1,
        'the enrolled parent keeps the club of their enrollment');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000b1',
        'SELECT count(*) FROM public.coach_profiles WHERE user_id = ''00000000-0000-0000-0000-0000000000c1''') = 1,
        'the enrolled parent keeps the coach of their enrollment');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000b1',
        'SELECT count(*) FROM public.camps WHERE id = ''00000000-0000-0000-0000-000000000012''') = 0,
        'an enrollment in one offer does not reveal the other offers of that coach');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000c1', format(v_anon, 'courses')) = 4,
        'a coach still reads every course');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000d3', format(v_anon, 'clubs')) = 3,
        'a club owner reads every approved club and its own unapproved club');
    PERFORM pg_temp.expect(pg_temp.visible('authenticated', '00000000-0000-0000-0000-0000000000a1', format(v_anon, 'coach_profiles')) = 3,
        'ADMIN reads every coach');
END;
$$;

-- A club with access covers its coaches in the coaches list.
UPDATE public.subscriptions SET status = 'active', plan_code = 'CLUB', current_period_end = now() + interval '20 days'
    WHERE club_id = '00000000-0000-0000-0000-0000000000e1';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, 'SELECT count(*) FROM public.coach_profiles') = 2, 'c3 is covered by club e1');
    PERFORM pg_temp.expect(pg_temp.visible('anon', NULL, 'SELECT count(*) FROM public.courses') = 3, 'club e1 courses are back at once');
END;
$$;
UPDATE public.subscriptions SET status = 'expired', plan_code = NULL, current_period_end = NULL
    WHERE club_id = '00000000-0000-0000-0000-0000000000e1';

-- New enrollments are refused on offers without access; existing rows and paid offers are fine.
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.enrollments (kind, entity_id, child_id)
        VALUES ('COURSE', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-00000000c0b1')$q$)
        = 'Această ofertă nu primește înscrieri momentan.|SUBSCRIPTION_INACTIVE', 'expired coach course refuses');
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.enrollments (kind, entity_id, adult_profile_id)
        VALUES ('CAMP', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-0000000000b1')$q$) IS NOT NULL,
        'expired club camp refuses an adult');
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.enrollments (kind, entity_id, child_id)
        VALUES ('COMPETITION', '00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-00000000c0b1')$q$) IS NOT NULL,
        'expired club competition refuses');
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.enrollments (kind, entity_id, child_id)
        VALUES ('ACTIVITY', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-00000000c0b1')$q$) IS NOT NULL,
        'expired coach activity refuses');
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.enrollments (kind, entity_id, child_id)
        VALUES ('COURSE', '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-00000000c0b1')$q$) IS NULL,
        'paid club course accepts');
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.enrollments (kind, entity_id, child_id)
        VALUES ('COMPETITION', '00000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-00000000c0b1')$q$) IS NULL,
        'ownerless competition accepts');
    UPDATE public.enrollments SET status = 'ACTIVE' WHERE entity_id = '00000000-0000-0000-0000-000000000011';
    PERFORM pg_temp.expect(FOUND, 'an existing enrollment can still be updated');
END;
$$;
DO $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', '', true);
    SET LOCAL ROLE anon;
    BEGIN
        PERFORM public.enrollment_offer_has_access('COURSE', '00000000-0000-0000-0000-000000000011');
        RAISE EXCEPTION 'anon must not call enrollment_offer_has_access';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RESET ROLE;
END;
$$;

-- #615 coach limits. e2 is on CLUB_START (3 coaches).
INSERT INTO public.profiles (id, role)
    SELECT ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'COACH' FROM generate_series(1, 12) i;
INSERT INTO public.coach_profiles (id, user_id)
    SELECT ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid,
           ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid FROM generate_series(1, 12) i;
DO $$
BEGIN
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscriptions WHERE subscriber_type = 'COACH') = 15,
        'every new coach profile gets a trial row automatically');
    PERFORM pg_temp.expect((SELECT bool_and(trial_end BETWEEN now() + interval '29 days' AND now() + interval '31 days')
        FROM public.subscriptions WHERE coach_user_id IN (SELECT user_id FROM public.coach_profiles WHERE id::text LIKE '%0000000002%')),
        'after launch a new coach gets signup_trial_days (30)');
END;
$$;

INSERT INTO public.club_coaches (club_id, coach_profile_id)
    SELECT '00000000-0000-0000-0000-0000000000e2', ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid
    FROM generate_series(1, 3) i;
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.club_coaches (club_id, coach_profile_id)
        VALUES ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000204')$q$)
        = 'COACH_LIMIT_REACHED|Clubul are 3 antrenori din 3 permiși de pachet.', 'Club Start refuses the 4th coach');
    PERFORM pg_temp.expect((public.club_coach_capacity('00000000-0000-0000-0000-0000000000e2', 'CLUB_START'))
        = '{"coachCount": 3, "coachLimit": 3, "hasRoom": false, "planCoachLimit": 3, "coachesToRemove": 0}'::jsonb,
        'capacity at 3/3');
END;
$$;

UPDATE public.subscriptions SET plan_code = 'CLUB' WHERE club_id = '00000000-0000-0000-0000-0000000000e2';
INSERT INTO public.club_coaches (club_id, coach_profile_id)
    SELECT '00000000-0000-0000-0000-0000000000e2', ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid
    FROM generate_series(4, 10) i;
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.club_coaches (club_id, coach_profile_id)
        VALUES ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000211')$q$) LIKE 'COACH_LIMIT_REACHED|%',
        'Club accepts the 10th and refuses the 11th coach');
    PERFORM pg_temp.expect((public.club_coach_capacity('00000000-0000-0000-0000-0000000000e2', 'CLUB_START'))->>'coachesToRemove' = '7',
        'a downgrade to Club Start needs 7 coaches removed');
    PERFORM pg_temp.expect((public.club_coach_capacity('00000000-0000-0000-0000-0000000000e2', 'CLUB_PRO'))->>'coachesToRemove' = '0',
        'Pro fits any number');
END;
$$;

UPDATE public.subscriptions SET plan_code = 'CLUB_PRO' WHERE club_id = '00000000-0000-0000-0000-0000000000e2';
INSERT INTO public.club_coaches (club_id, coach_profile_id) VALUES
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000211'),
    ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000212');

UPDATE public.subscriptions SET plan_code = 'CLUB_PRO', scheduled_plan_code = 'CLUB' WHERE club_id = '00000000-0000-0000-0000-0000000000e2';
DO $$
BEGIN
    PERFORM pg_temp.expect(pg_temp.refusal($q$INSERT INTO public.club_coaches (club_id, coach_profile_id)
        VALUES ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f1')$q$) LIKE 'COACH_LIMIT_REACHED|%',
        'a scheduled downgrade applies the smaller limit');
    PERFORM pg_temp.expect((SELECT count(*) FROM public.club_coaches WHERE club_id = '00000000-0000-0000-0000-0000000000e2') = 12,
        'no coach is removed by a lower limit');
END;
$$;

-- A club without a chosen plan (trial) has no limit.
INSERT INTO public.club_coaches (club_id, coach_profile_id)
    SELECT '00000000-0000-0000-0000-0000000000e1', ('00000000-0000-0000-0000-0000000002' || lpad(i::text, 2, '0'))::uuid
    FROM generate_series(1, 12) i;

-- #616 approval creates the club row with the signup trial.
UPDATE public.clubs SET approved_at = now() WHERE id = '00000000-0000-0000-0000-0000000000e3';
DO $$
BEGIN
    PERFORM pg_temp.expect((SELECT status = 'trialing' AND trial_end > now() + interval '29 days'
        FROM public.subscriptions WHERE club_id = '00000000-0000-0000-0000-0000000000e3'), 'an approved club gets a trial row');
END;
$$;
UPDATE public.clubs SET name = 'Renamed' WHERE id = '00000000-0000-0000-0000-0000000000e3';
DO $$
BEGIN
    PERFORM pg_temp.expect((SELECT count(*) FROM public.subscriptions WHERE club_id = '00000000-0000-0000-0000-0000000000e3') = 1,
        'later club updates create nothing');
END;
$$;

ROLLBACK;
\echo 'subscription access rules: all assertions passed'
