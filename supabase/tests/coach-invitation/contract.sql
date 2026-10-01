\set ON_ERROR_STOP on
\o /dev/null
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY,
    email TEXT,
    email_confirmed_at TIMESTAMPTZ,
    banned_until TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    raw_user_meta_data JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::UUID
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
REVOKE ALL ON auth.users FROM service_role;
\i /tmp/migrations/00001_schema.sql
\i /tmp/migrations/00034_signup_role_always_parent.sql
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE FUNCTION public.get_my_role() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
\i /tmp/migrations/00013_fix_profile_guard_trigger.sql
CREATE TRIGGER guard_profile_privileged_columns BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_invitation_codes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
\i /tmp/migrations/00079_atomic_coach_invitation.sql

CREATE FUNCTION public.test_uuid(v INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(v::TEXT,12,'0'))::UUID
$$;
CREATE FUNCTION public.test_assert(ok BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',label; END IF; END;
$$;
CREATE FUNCTION public.test_try_redeem(v_user INTEGER,v_code TEXT DEFAULT 'VALID',v_name TEXT DEFAULT 'Coach Test',
    v_phone TEXT DEFAULT NULL,v_bio TEXT DEFAULT NULL,v_sports UUID[] DEFAULT '{}')
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    PERFORM public.redeem_coach_invitation(public.test_uuid(v_user),v_code,v_name,v_phone,v_bio,v_sports);
    RETURN 'OK';
EXCEPTION WHEN OTHERS THEN RETURN SQLERRM;
END;
$$;
CREATE FUNCTION public.test_fail_profile() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.name = 'Fail Profile' THEN RAISE EXCEPTION 'TEST_PROFILE_WRITE_FAILURE'; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER test_profile_write BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.test_fail_profile();
CREATE FUNCTION public.test_fail_coach() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.bio = 'Fail Coach' THEN RAISE EXCEPTION 'TEST_COACH_WRITE_FAILURE'; END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER test_coach_write BEFORE INSERT ON public.coach_profiles
    FOR EACH ROW EXECUTE FUNCTION public.test_fail_coach();
CREATE FUNCTION public.test_fail_invitation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.code = 'FAIL-WRITE' AND NEW.current_uses > OLD.current_uses THEN
        RAISE EXCEPTION 'TEST_INVITATION_WRITE_FAILURE';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER test_invitation_write BEFORE UPDATE ON public.coach_invitation_codes
    FOR EACH ROW EXECUTE FUNCTION public.test_fail_invitation();

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
    SELECT public.test_uuid(v),'coach-' || v || '@local.test',now(),
        jsonb_build_object('name','Original ' || v,'phone','Existing phone','role','ADMIN')
    FROM generate_series(1,40) v;
UPDATE public.profiles SET role = CASE id
    WHEN public.test_uuid(1) THEN 'ADMIN' WHEN public.test_uuid(7) THEN 'ADMIN'
    WHEN public.test_uuid(8) THEN 'CLUB' WHEN public.test_uuid(9) THEN 'COACH'
    ELSE 'PARENT' END;
UPDATE public.profiles SET enabled=false WHERE id=public.test_uuid(6);
UPDATE public.profiles SET avatar_url='existing-avatar',oauth_provider='google',oauth_provider_id='existing-provider'
    WHERE id=public.test_uuid(2);
UPDATE auth.users SET email_confirmed_at=NULL WHERE id=public.test_uuid(10);
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id=public.test_uuid(11);
UPDATE auth.users SET deleted_at=now() WHERE id=public.test_uuid(12);
DELETE FROM public.profiles WHERE id=public.test_uuid(13);
INSERT INTO public.sports(id,code,name) VALUES(public.test_uuid(100),'SWIM','Swimming'),(public.test_uuid(101),'RUN','Running');
INSERT INTO public.coach_profiles(id,user_id,bio,stripe_account_id,bank_account)
    VALUES(public.test_uuid(109),public.test_uuid(9),'Existing bio','acct_existing','existing-bank'),
        (public.test_uuid(118),public.test_uuid(18),'Unexpected coach profile',NULL,NULL);
INSERT INTO public.coach_sports VALUES(public.test_uuid(109),public.test_uuid(100));
INSERT INTO public.children(id,parent_id,name,birth_date)
    VALUES(public.test_uuid(200),public.test_uuid(2),'Existing child','2018-01-01');
INSERT INTO public.enrollments(id,kind,entity_id,child_id,status,purchased_sessions,remaining_sessions)
    VALUES(public.test_uuid(201),'COURSE',public.test_uuid(202),public.test_uuid(200),'ACTIVE',10,8);
INSERT INTO public.coach_invitation_codes(code,created_by_admin_id,max_uses,current_uses,expires_at)
    VALUES('VALID',public.test_uuid(1),10,0,NULL),('EXPIRED',public.test_uuid(1),1,0,now()-interval '1 day'),
        ('EXHAUSTED',public.test_uuid(1),1,1,NULL),('ZERO',public.test_uuid(1),0,0,NULL),
        ('FAIL-WRITE',public.test_uuid(1),1,0,NULL),('ONE-USE',public.test_uuid(1),1,0,NULL),
        ('SAME-USER',public.test_uuid(1),1,0,NULL);
CREATE TABLE public.test_snapshots(kind TEXT PRIMARY KEY,value JSONB);
INSERT INTO public.test_snapshots VALUES
    ('parent',(SELECT to_jsonb(p) - ARRAY['role','name'] FROM public.profiles p WHERE id=public.test_uuid(2))),
    ('child',(SELECT to_jsonb(c) FROM public.children c WHERE id=public.test_uuid(200))),
    ('enrollment',(SELECT to_jsonb(e) FROM public.enrollments e WHERE id=public.test_uuid(201))),
    ('existingCoach',(SELECT to_jsonb(c) FROM public.coach_profiles c WHERE id=public.test_uuid(109)));
GRANT SELECT ON public.test_snapshots TO service_role;

SELECT public.test_assert(NOT has_function_privilege('anon','public.redeem_coach_invitation(uuid,text,text,text,text,uuid[])','EXECUTE'),'anon cannot redeem');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.redeem_coach_invitation(uuid,text,text,text,text,uuid[])','EXECUTE'),'authenticated cannot forge target user');
SELECT public.test_assert(has_function_privilege('service_role','public.redeem_coach_invitation(uuid,text,text,text,text,uuid[])','EXECUTE'),'service role can redeem');
SELECT public.test_assert(NOT has_table_privilege('service_role','auth.users','SELECT'),'service role cannot read auth users directly');
SELECT public.test_assert(NOT has_function_privilege('anon','private.coach_identity_is_verified(uuid)','EXECUTE')
    AND NOT has_function_privilege('authenticated','private.coach_identity_is_verified(uuid)','EXECUTE'),'private identity helper unavailable to clients');
SELECT public.test_assert((SELECT NOT prosecdef FROM pg_proc WHERE oid='public.redeem_coach_invitation(uuid,text,text,text,text,uuid[])'::regprocedure),'redemption is invoker');
SELECT public.test_assert((SELECT count(*)=4 AND bool_and(relrowsecurity) FROM pg_class
    WHERE oid IN ('public.profiles'::regclass,'public.coach_profiles'::regclass,'public.coach_sports'::regclass,'public.coach_invitation_codes'::regclass)),'all mutation tables enforce RLS');

SET LOCAL ROLE service_role;
SELECT public.test_assert(private.coach_identity_is_verified(public.test_uuid(2)), 'service can check identity without reading auth rows');
SELECT set_config('request.jwt.claim.sub',public.test_uuid(3)::TEXT,true);
SELECT public.test_assert(public.test_try_redeem(2)='IDENTITY_MISMATCH','non-null request subject must match verified actor');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT public.test_assert(public.test_try_redeem(3,'MISSING')='INVALID_INVITATION','invalid code denied');
SELECT public.test_assert(public.test_try_redeem(4,'EXPIRED')='INVITATION_EXPIRED','expired code denied');
SELECT public.test_assert(public.test_try_redeem(5,'EXHAUSTED')='INVITATION_EXHAUSTED','exhausted code denied');
SELECT public.test_assert(public.test_try_redeem(5,'ZERO')='INVITATION_EXHAUSTED','zero-capacity code denied');
SELECT public.test_assert(public.test_try_redeem(6)='PROFILE_DISABLED','disabled account denied');
SELECT public.test_assert(public.test_try_redeem(7)='ROLE_NOT_ELIGIBLE','admin conversion denied');
SELECT public.test_assert(public.test_try_redeem(8)='ROLE_NOT_ELIGIBLE','club conversion denied');
SELECT public.test_assert(public.test_try_redeem(10)='EMAIL_UNVERIFIED','unconfirmed email denied');
SELECT public.test_assert(public.test_try_redeem(11)='EMAIL_UNVERIFIED','banned auth identity denied');
SELECT public.test_assert(public.test_try_redeem(12)='EMAIL_UNVERIFIED','deleted auth identity denied');
SELECT public.test_assert(public.test_try_redeem(13)='PROFILE_NOT_FOUND','missing profile denied');
SELECT public.test_assert(public.test_try_redeem(18)='PROFILE_CONFLICT','parent with stale coach profile denied without overwrite');
SELECT public.test_assert(public.test_try_redeem(20,'VALID','x')='INVALID_REQUEST','invalid name denied');
SELECT public.test_assert(public.test_try_redeem(20,'VALID','Coach',NULL,NULL,ARRAY[NULL]::UUID[])='INVALID_REQUEST','null sport denied');
SELECT public.test_assert((SELECT count(*)=0 FROM public.coach_profiles WHERE user_id IN
    (public.test_uuid(3),public.test_uuid(4),public.test_uuid(5),public.test_uuid(6),public.test_uuid(7),public.test_uuid(8),public.test_uuid(10),public.test_uuid(11),public.test_uuid(12))),'denials create no coach profiles');
SELECT public.test_assert((SELECT bool_and(role=CASE id WHEN public.test_uuid(7) THEN 'ADMIN' WHEN public.test_uuid(8) THEN 'CLUB' ELSE 'PARENT' END)
    FROM public.profiles WHERE id BETWEEN public.test_uuid(3) AND public.test_uuid(8)),'denials preserve original roles');
SELECT public.test_assert((SELECT current_uses=0 AND used_by_user_id IS NULL AND used_at IS NULL FROM public.coach_invitation_codes WHERE code='VALID'),'denials consume nothing');

SELECT public.test_assert(public.test_try_redeem(14,'VALID','Coach Test',NULL,NULL,ARRAY[public.test_uuid(999)]) LIKE '%foreign key%','bad sport causes FK failure');
SELECT public.test_assert(public.test_try_redeem(15,'VALID','Fail Profile')='TEST_PROFILE_WRITE_FAILURE','profile write failure propagates');
SELECT public.test_assert(public.test_try_redeem(16,'VALID','Coach',NULL,'Fail Coach')='TEST_COACH_WRITE_FAILURE','coach profile write failure propagates');
SELECT public.test_assert(public.test_try_redeem(17,'FAIL-WRITE','Coach',NULL,NULL,ARRAY[public.test_uuid(100)])='TEST_INVITATION_WRITE_FAILURE','final invitation write failure propagates');
SELECT public.test_assert((SELECT count(*)=4 AND bool_and(role='PARENT' AND name LIKE 'Original %') FROM public.profiles
    WHERE id BETWEEN public.test_uuid(14) AND public.test_uuid(17)),'failed writes roll back promotion and name');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_profiles WHERE user_id BETWEEN public.test_uuid(14) AND public.test_uuid(17)),'failed writes roll back coach and sports');
SELECT public.test_assert((SELECT bool_and(current_uses=0 AND used_by_user_id IS NULL AND used_at IS NULL)
    FROM public.coach_invitation_codes WHERE code IN ('VALID','FAIL-WRITE')),'failed writes consume nothing');

SELECT public.test_assert(public.redeem_coach_invitation(public.test_uuid(2),' VALID ',' Coach New ',NULL,' Bio New ',
    ARRAY[public.test_uuid(100),public.test_uuid(101),public.test_uuid(100)]) ->> 'alreadyCoach'='false','existing parent promotes once');
SELECT public.test_assert((SELECT role='COACH' AND name='Coach New' FROM public.profiles WHERE id=public.test_uuid(2)),'profile receives explicit coach role and name');
SELECT public.test_assert((SELECT to_jsonb(p)-ARRAY['role','name'] FROM public.profiles p WHERE id=public.test_uuid(2))=
    (SELECT value FROM public.test_snapshots WHERE kind='parent'),'email phone OAuth avatar timestamps preserved');
SELECT public.test_assert((SELECT to_jsonb(c) FROM public.children c WHERE id=public.test_uuid(200))=
    (SELECT value FROM public.test_snapshots WHERE kind='child'),'existing child preserved');
SELECT public.test_assert((SELECT to_jsonb(e) FROM public.enrollments e WHERE id=public.test_uuid(201))=
    (SELECT value FROM public.test_snapshots WHERE kind='enrollment'),'existing enrollment preserved');
SELECT public.test_assert((SELECT count(*)=2 FROM public.coach_sports cs JOIN public.coach_profiles cp ON cp.id=cs.coach_profile_id
    WHERE cp.user_id=public.test_uuid(2)),'selected sports persisted without duplicates');
SELECT public.test_assert((SELECT bio='Bio New' AND stripe_account_id IS NULL FROM public.coach_profiles WHERE user_id=public.test_uuid(2)),'Google redemption creates no Stripe account');
SELECT public.test_assert((SELECT current_uses=1 AND used_by_user_id=public.test_uuid(2) AND used_at IS NOT NULL
    FROM public.coach_invitation_codes WHERE code='VALID'),'invitation usage records verified user once');
SELECT public.test_assert(public.redeem_coach_invitation(public.test_uuid(2),'EXPIRED','Other Name','Other phone','Other bio',
    ARRAY[public.test_uuid(999)]) ->> 'alreadyCoach'='true','repeat is idempotent even after invitation expiry');
SELECT public.test_assert((SELECT count(*)=1 FROM public.coach_profiles WHERE user_id=public.test_uuid(2))
    AND (SELECT current_uses=1 FROM public.coach_invitation_codes WHERE code='VALID'),'repeat creates neither profile nor invitation use');
SELECT public.test_assert((SELECT name='Coach New' AND phone='Existing phone' FROM public.profiles WHERE id=public.test_uuid(2)),
    'repeat does not overwrite profile');
SELECT public.test_assert(public.redeem_coach_invitation(public.test_uuid(9),'MISSING','Other Name') ->> 'coachProfileId'=public.test_uuid(109)::TEXT,'existing coach returns stable profile');
SELECT public.test_assert((SELECT to_jsonb(c) FROM public.coach_profiles c WHERE id=public.test_uuid(109))=
    (SELECT value FROM public.test_snapshots WHERE kind='existingCoach'),'existing coach billing and biography preserved');
UPDATE public.profiles SET enabled=false WHERE id=public.test_uuid(9);
SELECT public.test_assert(public.test_try_redeem(9)='PROFILE_DISABLED','disabled coach cannot reuse idempotent success');
SELECT public.test_assert(public.test_try_redeem(21,'VALID','Coach Phone',' New phone ')='OK','explicit new phone accepted');
SELECT public.test_assert((SELECT phone='New phone' FROM public.profiles WHERE id=public.test_uuid(21)),'phone trimmed');
COMMIT;
\o
