\set ON_ERROR_STOP on
BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.profiles(id UUID PRIMARY KEY, role TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true, deleted_at TIMESTAMPTZ);
CREATE TABLE public.clubs(id UUID PRIMARY KEY, owner_user_id UUID);
CREATE TABLE public.courses(id UUID PRIMARY KEY, coach_id UUID, club_id UUID);
CREATE TABLE public.activities(id UUID PRIMARY KEY, coach_id UUID);
CREATE TABLE public.camps(id UUID PRIMARY KEY, club_id UUID, coach_id UUID);
CREATE TABLE public.coach_profiles(id UUID PRIMARY KEY, user_id UUID NOT NULL);
CREATE TABLE public.camp_coaches(camp_id UUID NOT NULL REFERENCES public.camps(id),
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles(id),
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
    responded_at TIMESTAMPTZ,
    PRIMARY KEY (camp_id, coach_profile_id));
CREATE TABLE public.children(id UUID PRIMARY KEY, parent_id UUID NOT NULL, name TEXT NOT NULL, allergies TEXT);
CREATE TABLE public.enrollments(id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL,
    child_id UUID REFERENCES public.children(id), status TEXT NOT NULL);
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION public.my_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id FROM public.children WHERE parent_id = auth.uid()
$$;
CREATE FUNCTION public.my_club_ids() RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid()
$$;
CREATE FUNCTION public.coach_enrolled_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
    SELECT NULL::UUID WHERE false
$$;
CREATE FUNCTION public.club_enrolled_child_ids() RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
    SELECT NULL::UUID WHERE false
$$;
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$function$

;
CREATE OR REPLACE FUNCTION public.pot_administra_tabara(p_camp_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.camps c
        WHERE c.id = p_camp_id
          AND (
              c.club_id IN (SELECT my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$function$

;
CREATE OR REPLACE FUNCTION public.raspunde_invitatie_tabara(p_camp_id uuid, p_accept boolean)
 RETURNS camp_coaches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    randul public.camp_coaches;
BEGIN
    UPDATE public.camp_coaches k
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now()
    WHERE k.camp_id = p_camp_id
      AND k.coach_profile_id IN (
          SELECT id FROM public.coach_profiles WHERE user_id = (SELECT auth.uid())
      )
    RETURNING * INTO randul;

    IF randul IS NULL THEN
        RAISE EXCEPTION 'Nu exista o invitatie pentru tine la tabara %', p_camp_id
            USING ERRCODE = 'P0001';
    END IF;

    RETURN randul;
END;
$function$

;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
\i /tmp/migrations/00028_camp_enrollments_and_orphan_photos.sql
\i /tmp/migrations/00032_camp_enrolled_children.sql
\i /tmp/migrations/00126_camp_enrollments_accepted_coaches.sql

CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT, 12, '0'))::UUID
$$;
INSERT INTO public.profiles(id, role, enabled, deleted_at) VALUES
    (public.test_uuid(1), 'ADMIN', true, NULL), (public.test_uuid(11), 'ADMIN', false, NULL),
    (public.test_uuid(2), 'CLUB', true, NULL), (public.test_uuid(12), 'CLUB', false, NULL),
    (public.test_uuid(3), 'COACH', true, NULL), (public.test_uuid(13), 'COACH', true, now()),
    (public.test_uuid(4), 'COACH', true, NULL), (public.test_uuid(14), 'COACH', false, NULL),
    (public.test_uuid(5), 'COACH', true, NULL), (public.test_uuid(6), 'COACH', true, NULL),
    (public.test_uuid(7), 'COACH', true, NULL), (public.test_uuid(8), 'PARENT', true, NULL);
INSERT INTO public.clubs(id, owner_user_id) VALUES
    (public.test_uuid(100), public.test_uuid(2)), (public.test_uuid(101), public.test_uuid(12));
INSERT INTO public.camps(id, club_id, coach_id) VALUES
    (public.test_uuid(200), public.test_uuid(100), NULL),
    (public.test_uuid(201), public.test_uuid(101), NULL),
    (public.test_uuid(202), NULL, public.test_uuid(3)),
    (public.test_uuid(203), NULL, public.test_uuid(13));
INSERT INTO public.coach_profiles(id, user_id) VALUES
    (public.test_uuid(304), public.test_uuid(4)), (public.test_uuid(314), public.test_uuid(14)),
    (public.test_uuid(305), public.test_uuid(5)), (public.test_uuid(306), public.test_uuid(6)),
    (public.test_uuid(307), public.test_uuid(7));
INSERT INTO public.camp_coaches(camp_id, coach_profile_id, status) VALUES
    (public.test_uuid(200), public.test_uuid(304), 'accepted'),
    (public.test_uuid(200), public.test_uuid(314), 'accepted'),
    (public.test_uuid(200), public.test_uuid(305), 'invited'),
    (public.test_uuid(200), public.test_uuid(306), 'declined'),
    (public.test_uuid(201), public.test_uuid(307), 'accepted');
INSERT INTO public.children(id, parent_id, name, allergies) VALUES
    (public.test_uuid(400), public.test_uuid(8), 'Copil tabăra clubului', 'arahide'),
    (public.test_uuid(401), public.test_uuid(8), 'Copil tabăra clubului dezactivat', NULL),
    (public.test_uuid(402), public.test_uuid(8), 'Copil tabăra antrenorului', NULL),
    (public.test_uuid(403), public.test_uuid(8), 'Copil tabăra antrenorului șters', NULL);
INSERT INTO public.enrollments(id, kind, entity_id, child_id, status) VALUES
    (public.test_uuid(500), 'CAMP', public.test_uuid(200), public.test_uuid(400), 'ACTIVE'),
    (public.test_uuid(501), 'CAMP', public.test_uuid(201), public.test_uuid(401), 'ACTIVE'),
    (public.test_uuid(502), 'CAMP', public.test_uuid(202), public.test_uuid(402), 'ACTIVE'),
    (public.test_uuid(503), 'CAMP', public.test_uuid(203), public.test_uuid(403), 'PENDING');

CREATE TEMP TABLE visibility(phase TEXT, actor TEXT, camp_enrollments INTEGER, camp_children INTEGER);
GRANT ALL ON visibility TO authenticated;
CREATE FUNCTION pg_temp.observe(p_phase TEXT, p_actor TEXT, p_user INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(p_user)::TEXT, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO visibility VALUES (p_phase, p_actor,
        (SELECT count(*) FROM public.enrollments WHERE kind = 'CAMP'),
        (SELECT count(*) FROM public.children));
    RESET ROLE;
END
$$;

CREATE FUNCTION pg_temp.answer(p_user INTEGER, p_camp INTEGER, p_accept BOOLEAN) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(p_user)::TEXT, true);
    SET LOCAL ROLE authenticated;
    BEGIN
        PERFORM public.raspunde_invitatie_tabara(public.test_uuid(p_camp), p_accept);
        RESET ROLE;
        RETURN 'ok';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        RESET ROLE;
        RETURN 'refused';
    END;
END
$$;
GRANT EXECUTE ON FUNCTION public.raspunde_invitatie_tabara(UUID, BOOLEAN) TO authenticated;

SELECT pg_temp.observe('before', 'disabled admin', 11);
SELECT pg_temp.observe('before', 'disabled club owner', 12);
SELECT pg_temp.observe('before', 'deleted coach owner', 13);
SELECT pg_temp.observe('before', 'disabled accepted coach', 14);
DO $$
BEGIN
    IF (SELECT count(*) FROM visibility
        WHERE phase = 'before' AND camp_enrollments > 0 AND camp_children > 0) <> 4 THEN
        RAISE EXCEPTION 'Testul nu mai reproduce bug-ul #1364 pe sursele de dinainte de 00129.';
    END IF;
    IF pg_temp.answer(6, 200, true) <> 'ok' THEN
        RAISE EXCEPTION 'Testul nu mai reproduce bug-ul #1365: refuzul trebuia să poată fi schimbat.';
    END IF;
    UPDATE public.camp_coaches SET status = 'declined', responded_at = NULL
    WHERE camp_id = public.test_uuid(200) AND coach_profile_id = public.test_uuid(306);
END
$$;

\i /tmp/migrations/00129_camp_access_active_accounts.sql

SELECT pg_temp.observe('after', 'admin', 1);
SELECT pg_temp.observe('after', 'disabled admin', 11);
SELECT pg_temp.observe('after', 'club owner', 2);
SELECT pg_temp.observe('after', 'disabled club owner', 12);
SELECT pg_temp.observe('after', 'coach owner', 3);
SELECT pg_temp.observe('after', 'deleted coach owner', 13);
SELECT pg_temp.observe('after', 'accepted coach', 4);
SELECT pg_temp.observe('after', 'disabled accepted coach', 14);
SELECT pg_temp.observe('after', 'invited coach', 5);
SELECT pg_temp.observe('after', 'declined coach', 6);
SELECT pg_temp.observe('after', 'parent', 8);
SELECT * FROM visibility ORDER BY phase DESC, actor;

DO $$
DECLARE
    v_expected JSONB := jsonb_build_object(
        'admin', '[4,4]'::JSONB, 'club owner', '[1,1]'::JSONB, 'coach owner', '[1,1]'::JSONB,
        'accepted coach', '[1,1]'::JSONB, 'parent', '[4,4]'::JSONB,
        'disabled admin', '[0,0]'::JSONB, 'disabled club owner', '[0,0]'::JSONB, 'deleted coach owner', '[0,0]'::JSONB,
        'disabled accepted coach', '[0,0]'::JSONB, 'invited coach', '[0,0]'::JSONB, 'declined coach', '[0,0]'::JSONB);
    v_row RECORD;
BEGIN
    FOR v_row IN SELECT * FROM visibility WHERE phase = 'after' LOOP
        IF v_row.camp_enrollments <> (v_expected->v_row.actor->>0)::INTEGER
           OR v_row.camp_children <> (v_expected->v_row.actor->>1)::INTEGER THEN
            RAISE EXCEPTION 'Vizibilitate greșită pentru %: % înscrieri, % copii', v_row.actor,
                v_row.camp_enrollments, v_row.camp_children;
        END IF;
    END LOOP;
END
$$;

DO $$
BEGIN
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(11)::TEXT, true);
    IF public.get_my_role() IS NOT NULL THEN
        RAISE EXCEPTION 'Un admin dezactivat nu trebuie să mai aibă rol.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(1)::TEXT, true);
    IF public.get_my_role() IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'Adminul activ trebuie să-și păstreze rolul.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(12)::TEXT, true);
    IF public.pot_administra_tabara(public.test_uuid(201)) THEN
        RAISE EXCEPTION 'Clubul dezactivat nu mai administrează tabăra lui.';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', public.test_uuid(3)::TEXT, true);
    IF NOT public.pot_administra_tabara(public.test_uuid(202)) THEN
        RAISE EXCEPTION 'Antrenorul activ își administrează în continuare tabăra.';
    END IF;
END
$$;

DO $$
BEGIN
    IF pg_temp.answer(6, 200, true) <> 'refused' THEN
        RAISE EXCEPTION 'Un antrenor care a refuzat nu poate accepta fără invitație nouă.';
    END IF;
    IF pg_temp.answer(4, 200, false) <> 'refused' THEN
        RAISE EXCEPTION 'Un răspuns dat nu se mai schimbă prin funcție.';
    END IF;
    IF pg_temp.answer(5, 200, false) <> 'ok' OR pg_temp.answer(5, 200, true) <> 'refused' THEN
        RAISE EXCEPTION 'Invitatul refuză o dată, apoi refuzul e final.';
    END IF;
    DELETE FROM public.camp_coaches WHERE camp_id = public.test_uuid(200) AND coach_profile_id = public.test_uuid(305);
    INSERT INTO public.camp_coaches(camp_id, coach_profile_id) VALUES (public.test_uuid(200), public.test_uuid(305));
    IF pg_temp.answer(5, 200, true) <> 'ok' THEN
        RAISE EXCEPTION 'După o invitație nouă antrenorul poate accepta.';
    END IF;
    IF (SELECT status FROM public.camp_coaches
        WHERE camp_id = public.test_uuid(200) AND coach_profile_id = public.test_uuid(305)) <> 'accepted' THEN
        RAISE EXCEPTION 'Invitația nouă trebuia să ajungă acceptată.';
    END IF;
END
$$;

DO $$
BEGIN
    BEGIN
        EXECUTE pg_read_file('/tmp/migrations/00129_camp_access_active_accounts.sql');
        RAISE EXCEPTION 'guard-missed';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM = 'guard-missed' THEN
            RAISE EXCEPTION 'Migrația 00129 trebuie să refuze o funcție schimbată de altă migrație.';
        END IF;
    END;
END
$$;

ROLLBACK;
\echo 'camp access for active accounts: ok'
