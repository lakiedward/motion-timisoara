\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('COACH','CLUB','PARENT','ADMIN')), enabled BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE public.clubs (
    id UUID PRIMARY KEY, owner_user_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE
);
CREATE TABLE public.courses (
    id UUID PRIMARY KEY, coach_id UUID NOT NULL REFERENCES public.profiles,
    club_id UUID REFERENCES public.clubs, active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE public.course_occurrences (
    id UUID PRIMARY KEY, course_id UUID NOT NULL REFERENCES public.courses ON DELETE CASCADE,
    starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE public.children (
    id UUID PRIMARY KEY, parent_id UUID NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
    name TEXT NOT NULL, qr_token TEXT NOT NULL UNIQUE
);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY, kind TEXT NOT NULL, entity_id UUID NOT NULL,
    child_id UUID NOT NULL REFERENCES public.children ON DELETE CASCADE,
    status TEXT NOT NULL, remaining_sessions INTEGER NOT NULL DEFAULT 10, sessions_used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL REFERENCES public.course_occurrences ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('PRESENT','ABSENT')), UNIQUE(occurrence_id,child_id)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.attendance TO authenticated, service_role;
GRANT SELECT ON public.profiles,public.clubs,public.courses,public.course_occurrences,public.children,public.enrollments TO service_role;
\i /tmp/transactional-attendance-migration.sql
\i /tmp/coach-live-location-migration.sql

CREATE TABLE public.test_results (label TEXT NOT NULL);
GRANT SELECT, INSERT ON public.test_results TO service_role;
CREATE FUNCTION public.test_uuid(n INTEGER) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$
    SELECT ('00000000-0000-0000-0000-' || lpad(n::TEXT,12,'0'))::UUID
$$;
CREATE FUNCTION public.test_assert(value BOOLEAN,label TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assertion failed: %',label; END IF;
    INSERT INTO public.test_results VALUES(label);
END $$;
CREATE FUNCTION public.test_live(actor INTEGER,action TEXT,occurrence INTEGER DEFAULT 101,extra JSONB DEFAULT '{}')
RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.coach_live_location_transaction(public.test_uuid(actor),
        jsonb_build_object('action',action,'occurrenceId',public.test_uuid(occurrence)) ||
        CASE WHEN action='start' THEN jsonb_build_object('requestId',gen_random_uuid())
            WHEN action='consent' THEN jsonb_build_object('expectedVersion',(SELECT coalesce(max(version),0)
                FROM public.parent_live_location_consents WHERE session_id=(extra->>'sessionId')::UUID AND parent_id=public.test_uuid(actor)))
            ELSE '{}'::JSONB END || extra)
$$;
CREATE FUNCTION public.test_session(occurrence INTEGER DEFAULT 101) RETURNS JSONB LANGUAGE sql AS $$
    SELECT jsonb_build_object('sessionId',id) FROM public.coach_live_location_sessions WHERE occurrence_id=public.test_uuid(occurrence)
$$;
CREATE FUNCTION public.test_point(captured TIMESTAMPTZ DEFAULT clock_timestamp()) RETURNS JSONB LANGUAGE sql AS $$
    SELECT jsonb_build_object('latitude',45.75,'longitude',21.23,'accuracy',5,'capturedAt',captured)
$$;
CREATE FUNCTION public.test_record(req INTEGER,child INTEGER,status TEXT,qr BOOLEAN DEFAULT false,occurrence INTEGER DEFAULT 101)
RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.record_attendance_transaction(public.test_uuid(1),
        jsonb_build_object('requestId',public.test_uuid(10000+req),'occurrenceId',public.test_uuid(occurrence),'status',status) ||
        CASE WHEN qr THEN jsonb_build_object('qrToken',md5(public.test_uuid(child)::TEXT)) ELSE jsonb_build_object('childId',public.test_uuid(child)) END)
$$;
INSERT INTO auth.users(id) SELECT public.test_uuid(n) FROM generate_series(1,12) n;
INSERT INTO public.profiles SELECT public.test_uuid(n),CASE n WHEN 1 THEN 'COACH' WHEN 3 THEN 'COACH' WHEN 4 THEN 'ADMIN'
    WHEN 5 THEN 'COACH' WHEN 6 THEN 'CLUB' WHEN 7 THEN 'CLUB' ELSE 'PARENT' END,n<>5 FROM generate_series(1,12) n;
INSERT INTO public.clubs VALUES (public.test_uuid(21),public.test_uuid(6)),(public.test_uuid(22),public.test_uuid(7));
INSERT INTO public.courses VALUES (public.test_uuid(11),public.test_uuid(1),public.test_uuid(21),true),
    (public.test_uuid(12),public.test_uuid(3),public.test_uuid(22),true);
INSERT INTO public.course_occurrences SELECT public.test_uuid(n),public.test_uuid(CASE WHEN n=103 THEN 12 ELSE 11 END),
    now()-interval '15 minutes',now()+interval '30 minutes' FROM generate_series(101,106) n;
UPDATE public.course_occurrences SET starts_at=now()+interval '1 hour',ends_at=now()+interval '2 hours' WHERE id=public.test_uuid(104);
UPDATE public.course_occurrences SET starts_at=now()-interval '2 hours',ends_at=now()-interval '20 minutes' WHERE id=public.test_uuid(105);
INSERT INTO public.children SELECT public.test_uuid(n),public.test_uuid(CASE n WHEN 201 THEN 2 WHEN 202 THEN 8
    WHEN 203 THEN 9 WHEN 204 THEN 10 WHEN 205 THEN 11 ELSE 12 END),'Child '||n,md5(public.test_uuid(n)::TEXT)
    FROM generate_series(201,206) n;
INSERT INTO public.enrollments(id,kind,entity_id,child_id,status)
    SELECT public.test_uuid(n+1000),'COURSE',public.test_uuid(11),public.test_uuid(n),'ACTIVE' FROM generate_series(201,206) n;
SELECT public.test_assert((SELECT count(*)=1 FROM cron.job WHERE jobname='purge-expired-coach-live-locations'
    AND schedule='* * * * *' AND command='SELECT private.purge_expired_coach_live_locations();' AND active),'cron registers active purge every minute');

SELECT public.test_assert(NOT has_function_privilege('anon','public.coach_live_location_transaction(uuid,jsonb)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.coach_live_location_transaction(uuid,jsonb)','EXECUTE')
    AND has_function_privilege('service_role','public.coach_live_location_transaction(uuid,jsonb)','EXECUTE'),'RPC service role privilege');
SELECT public.test_assert(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.coach_live_location_transaction(uuid,jsonb)'::regprocedure),'public RPC uses invoker');
SELECT public.test_assert((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.coach_live_location_sessions'::regclass,
    'public.coach_live_locations'::regclass,'public.parent_live_location_consents'::regclass,'public.coach_live_location_starts'::regclass)),'all live location tables enable RLS');
DO $$ DECLARE table_name TEXT; role_name TEXT; BEGIN
    FOREACH table_name IN ARRAY ARRAY['coach_live_location_sessions','coach_live_locations','parent_live_location_consents','coach_live_location_starts'] LOOP
        FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
            PERFORM public.test_assert(NOT has_table_privilege(role_name,'public.'||table_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
                role_name||' has no direct privileges on '||table_name);
        END LOOP;
    END LOOP;
END $$;
SET ROLE authenticated;
DO $$ BEGIN
    BEGIN PERFORM public.test_live(1,'start',101,'{"consent":true}'); RAISE EXCEPTION 'authenticated RPC allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM * FROM public.coach_live_locations; RAISE EXCEPTION 'authenticated read allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
    BEGIN PERFORM public.test_live(1,'start',101,'{"consent":true}'); RAISE EXCEPTION 'anon RPC allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE service_role;
SELECT public.test_assert(current_user='service_role','RPC tests use genuine service role');
SELECT public.test_assert(public.test_live(1,'start')->>'code'='INVALID_REQUEST','coach must opt in explicitly');
SELECT public.test_assert(public.test_live(1,'start',101,'{"consent":false}')->>'code'='CONSENT_REQUIRED','false coach consent rejected');
SELECT public.test_assert(public.test_live(3,'start',101,'{"consent":true}')->>'code'='FORBIDDEN','foreign coach cannot start');
SELECT public.test_assert(public.test_live(5,'start',101,'{"consent":true}')->>'code'='FORBIDDEN','disabled coach cannot start');
SELECT public.test_assert(public.test_live(2,'start',101,'{"consent":true}')->>'code'='FORBIDDEN','parent cannot start');
SELECT public.test_assert(public.test_live(6,'start',101,'{"consent":true}')->>'code'='FORBIDDEN','owning club cannot start');
SELECT public.test_assert(public.test_live(4,'start',101,'{"consent":true}')->>'code'='FORBIDDEN','admin cannot start');
SELECT public.test_assert(public.test_live(1,'start',999,'{"consent":true}')->>'code'='OCCURRENCE_NOT_FOUND','unknown occurrence rejected');
SELECT public.test_assert(public.test_live(1,'start',104,'{"consent":true}')->>'success'='false','future occurrence cannot start');
SELECT public.test_assert(public.test_live(1,'start',105,'{"consent":true}')->>'code'='SESSION_EXPIRED','expired occurrence cannot start');
RESET ROLE;
UPDATE public.courses SET active=false WHERE id=public.test_uuid(11);
SET ROLE service_role;
SELECT public.test_assert(public.test_live(1,'start',101,'{"consent":true}')->>'code'='SESSION_EXPIRED','inactive course cannot start');
RESET ROLE;
UPDATE public.courses SET active=true WHERE id=public.test_uuid(11);
SET ROLE service_role;
SELECT public.test_assert(public.test_live(1,'start',101,jsonb_build_object('consent',true,'requestId',public.test_uuid(701)))->>'success'='true','own enabled coach starts active occurrence');
SELECT public.test_assert((SELECT s.expires_at=o.ends_at+interval '15 minutes' FROM public.coach_live_location_sessions s
    JOIN public.course_occurrences o ON o.id=s.occurrence_id WHERE o.id=public.test_uuid(101)),'expiry is occurrence end plus fifteen minutes');
SELECT public.test_assert(public.test_live(1,'start',101,jsonb_build_object('consent',true,'requestId',public.test_uuid(701)))->>'sessionId'=public.test_session()->>'sessionId','active start is idempotent');
SELECT public.test_assert(public.test_live(1,'start',102,jsonb_build_object('consent',true,'requestId',public.test_uuid(701)))->>'code'='INVALID_REQUEST','start receipt is bound to occurrence');
SELECT public.test_assert(public.test_live(3,'start',103,jsonb_build_object('consent',true,'requestId',public.test_uuid(701)))->>'code'='INVALID_REQUEST','start receipt is bound to coach');
SELECT public.test_assert(public.coach_live_location_transaction(public.test_uuid(1),jsonb_build_object('action','start','occurrenceId',public.test_uuid(101),'consent',true))->>'code'='INVALID_REQUEST','start request nonce required');
SELECT public.test_assert(public.test_live(1,'read',101,public.test_session())->'location'='null'::JSONB,'initial read has no point');
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point())->>'success'='true','coach writes a fresh point');
SELECT public.test_assert((public.test_live(1,'read',101,public.test_session())->'location'->>'latitude')::NUMERIC=45.75,'coach reads point');
SELECT public.test_assert(public.test_live(6,'read',101,public.test_session())->>'success'='true','owning club reads');
SELECT public.test_assert(public.test_live(7,'read',101,public.test_session())->>'code'='FORBIDDEN','foreign club cannot read');
SELECT public.test_assert(public.test_live(3,'read',101,public.test_session())->>'code'='FORBIDDEN','foreign coach cannot read');
SELECT public.test_assert(public.test_live(4,'read',101,public.test_session())->>'code'='FORBIDDEN','admin cannot read');
SELECT public.test_assert(public.test_live(6,'update',101,public.test_session()||public.test_point())->>'code'='FORBIDDEN','owning club cannot update');
SELECT public.test_assert(public.test_live(6,'stop',101,public.test_session())->>'code'='FORBIDDEN','owning club cannot stop');
SELECT public.test_assert(public.test_live(2,'update',101,public.test_session()||public.test_point())->>'code'='FORBIDDEN','parent cannot update');
SELECT public.test_assert(public.test_live(1,'read',102,public.test_session())->>'code'='SESSION_NOT_FOUND','session does not cross occurrences');
SELECT public.test_assert(public.test_live(1,'read',101,jsonb_build_object('sessionId',public.test_uuid(999)))->>'code'='SESSION_NOT_FOUND','wrong nonce rejected');
SELECT public.test_assert(public.test_live(1,'status',101)->>'sessionId'=public.test_session()->>'sessionId','own coach discovers current session');
SELECT public.test_assert(public.test_live(6,'status',101)->>'success'='true','own club discovers current session');
SELECT public.test_assert(public.test_live(3,'status',101)->>'code'='FORBIDDEN','foreign coach cannot discover session');
SELECT public.test_assert(public.test_live(7,'status',101)->>'code'='FORBIDDEN','foreign club cannot discover session');
SELECT public.test_assert(public.test_live(4,'status',101)->>'code'='FORBIDDEN','admin cannot discover session');
SELECT public.test_assert(public.test_live(1,'status',106)->>'code'='SESSION_NOT_FOUND','status cannot invent absent session');
SELECT public.test_assert(public.test_record(1,201,'PRESENT',true)->>'outcome'='recorded','real QR attendance fixture recorded');
SELECT public.test_assert((SELECT qr_processed FROM public.attendance_accounting WHERE child_id=public.test_uuid(201)),'real QR receipt is present');
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='CONSENT_REQUIRED','eligible parent must consent');
SELECT public.test_assert(public.test_live(2,'status',101)->>'sessionId'=public.test_session()->>'sessionId','eligible parent discovers session before consent');
SELECT public.test_assert(NOT(public.test_live(2,'status',101)?'location'),'status never returns coordinates before consent');
SELECT public.test_assert(public.test_live(2,'status',101)->>'consentVersion'='0' AND public.test_live(2,'status',101)->>'consentGranted'='false','status gives initial parent consent version');
SELECT public.test_assert(public.test_live(2,'consent',101,jsonb_build_object('sessionId',public.test_live(2,'status',101)->>'sessionId','consent',true,
    'expectedVersion',(public.test_live(2,'status',101)->>'consentVersion')::INTEGER))->>'success'='true','eligible parent opts in using discovered nonce and version');
SELECT public.test_assert(public.test_live(2,'read',101,jsonb_build_object('sessionId',public.test_live(2,'status',101)->>'sessionId'))->>'success'='true','consented QR parent reads using discovered nonce');
SELECT public.test_assert(public.test_record(2,202,'PRESENT')->>'outcome'='recorded','manual attendance fixture recorded');
SELECT public.test_assert(public.test_live(8,'consent',101,public.test_session()||'{"consent":true}')->>'code'='NOT_ELIGIBLE','manual-only parent cannot consent');
SELECT public.test_assert(public.test_live(8,'status',101)->>'code'='NOT_ELIGIBLE','manual-only parent cannot discover session');
SELECT public.test_assert(public.test_record(3,203,'PRESENT',true,102)->>'outcome'='recorded','other occurrence QR recorded');
SELECT public.test_assert(public.test_live(9,'consent',101,public.test_session()||'{"consent":true}')->>'code'='NOT_ELIGIBLE','QR from another occurrence insufficient');
SELECT public.test_assert(public.test_live(10,'consent',101,public.test_session()||'{"consent":true}')->>'code'='NOT_ELIGIBLE','other child cannot reuse parent eligibility');
SELECT public.test_assert(public.test_live(2,'consent',101,public.test_session()||'{"consent":false,"expectedVersion":1}')->>'success'='true','parent revokes consent');
SELECT public.test_assert(public.test_live(2,'consent',101,public.test_session()||'{"consent":true,"expectedVersion":0}')->>'code'='REQUEST_CONFLICT','delayed old grant cannot override consent revocation');
SELECT public.test_assert((SELECT NOT granted AND version=2 FROM public.parent_live_location_consents WHERE parent_id=public.test_uuid(2)),'revocation keeps versioned denial tombstone');
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='CONSENT_REQUIRED','revoked parent loses access');
SELECT public.test_assert(public.test_live(2,'consent',101,public.test_session()||'{"consent":true,"expectedVersion":2}')->>'success'='true','fresh consent after revocation uses current version');
SELECT public.test_assert(public.test_record(4,201,'ABSENT')->>'outcome'='recorded','QR presence manually corrected absent');
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='NOT_ELIGIBLE','absent parent loses access');
DO $$ DECLARE discovered JSONB; payload JSONB; BEGIN
    discovered := public.coach_live_location_transaction(public.test_uuid(2),jsonb_build_object('action','status','occurrenceId',public.test_uuid(101)));
    PERFORM public.test_assert(discovered->>'success'='true' AND discovered->>'consentVersion'='3','absent parent discovers own current consent version');
    PERFORM public.test_assert(NOT(discovered?'location'),'absent parent status discloses no coordinates');
    payload := jsonb_build_object('action','consent','occurrenceId',public.test_uuid(101),'sessionId',discovered->>'sessionId',
        'expectedVersion',(discovered->>'consentVersion')::INTEGER,'consent',true);
    PERFORM public.test_assert(public.coach_live_location_transaction(public.test_uuid(2),payload)->>'code'='NOT_ELIGIBLE','absent parent cannot grant new consent');
    PERFORM public.test_assert(public.coach_live_location_transaction(public.test_uuid(2),payload||'{"consent":false}')->>'success'='true','absent parent revokes using status version');
    PERFORM public.test_assert(public.test_live(2,'status',101)->>'consentVersion'='4' AND public.test_live(2,'status',101)->>'consentGranted'='false','absent parent can confirm revoked version');
    PERFORM public.test_assert(public.test_live(10,'status',101)->>'code'='NOT_ELIGIBLE','outsider without consent row cannot discover metadata');
END $$;
SELECT public.test_record(5,201,'PRESENT');
SELECT public.test_live(2,'consent',101,public.test_session()||'{"consent":true}');
SELECT public.test_record(6,201,null);
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='NOT_ELIGIBLE','unmarked parent loses access');
SELECT public.test_record(7,201,'PRESENT');
RESET ROLE;
UPDATE public.enrollments SET status='CANCELLED' WHERE id=public.test_uuid(1201);
SET ROLE service_role;
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='NOT_ELIGIBLE','cancelled enrollment denies parent');
RESET ROLE;
UPDATE public.enrollments SET status='ACTIVE',kind='CAMP' WHERE id=public.test_uuid(1201);
SET ROLE service_role;
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='NOT_ELIGIBLE','non-course enrollment denies parent');
RESET ROLE;
UPDATE public.enrollments SET kind='COURSE',entity_id=public.test_uuid(12) WHERE id=public.test_uuid(1201);
SET ROLE service_role;
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='NOT_ELIGIBLE','wrong course enrollment denies parent');
RESET ROLE;
UPDATE public.enrollments SET entity_id=public.test_uuid(11) WHERE id=public.test_uuid(1201);
UPDATE public.profiles SET enabled=false WHERE id IN (public.test_uuid(1),public.test_uuid(2),public.test_uuid(6));
SET ROLE service_role;
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point())->>'code'='FORBIDDEN','disabled owner cannot update');
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='FORBIDDEN','disabled parent cannot read');
SELECT public.test_assert(public.test_live(6,'read',101,public.test_session())->>'code'='FORBIDDEN','disabled owning club cannot read');
RESET ROLE;
UPDATE public.profiles SET enabled=true WHERE id IN (public.test_uuid(1),public.test_uuid(2),public.test_uuid(6));
SET ROLE service_role;
DO $$ DECLARE invalid JSONB; BEGIN
    FOR invalid IN SELECT value FROM jsonb_array_elements('[{"latitude":91},{"latitude":-91},{"longitude":181},{"longitude":-181},
        {"latitude":"NaN"},{"longitude":"Infinity"},{"accuracy":"-Infinity"},{"accuracy":-1},{"accuracy":10001},{"accuracy":null}]') LOOP
        PERFORM public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point()||invalid)->>'code'='INVALID_REQUEST',
            'invalid coordinate rejected '||invalid::TEXT);
    END LOOP;
END $$;
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||(public.test_point()-'accuracy'))->>'code'='INVALID_REQUEST','accuracy required');
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point(clock_timestamp()-interval '3 minutes'))->>'code'='STALE_LOCATION','old timestamp rejected');
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point(clock_timestamp()+interval '31 seconds'))->>'code'='STALE_LOCATION','future timestamp rejected');
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point((SELECT started_at-interval '1 microsecond' FROM public.coach_live_location_sessions WHERE occurrence_id=public.test_uuid(101))))->>'code'='STALE_LOCATION','point predating session rejected');
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point((SELECT captured_at FROM public.coach_live_locations WHERE session_id=(public.test_session()->>'sessionId')::UUID)))->>'code'='STALE_LOCATION','equal timestamp rejected');
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point())->>'success'='true','newer timestamp accepted');
SELECT public.test_assert((SELECT count(*)=1 FROM public.coach_live_locations),'updates replace point without history');
SELECT public.test_assert(public.coach_live_location_transaction(public.test_uuid(1),'{}')->>'code'='INVALID_REQUEST','missing payload fields rejected');
SELECT public.test_assert(public.test_live(1,'invalid')->>'code'='INVALID_REQUEST','unknown action rejected');
RESET ROLE;
CREATE TABLE public.test_saved_session AS SELECT id,started_at FROM public.coach_live_location_sessions WHERE occurrence_id=public.test_uuid(101);
GRANT SELECT ON public.test_saved_session TO service_role;
SET ROLE service_role;
SELECT public.test_assert(public.test_live(1,'stop',101,public.test_session())->>'success'='true','coach stops session');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_sessions) AND NOT EXISTS(SELECT FROM public.coach_live_locations)
    AND NOT EXISTS(SELECT FROM public.parent_live_location_consents),'stop physically cascades session point and consents');
SELECT public.test_assert(public.test_live(1,'start',101,jsonb_build_object('consent',true,'requestId',public.test_uuid(701)))->>'code'='SESSION_NOT_FOUND','delayed old start retry cannot restart stopped session');
SELECT public.test_assert(public.test_live(1,'start',101,'{"consent":true}')->>'success'='true','coach restarts');
SELECT public.test_assert((public.test_session()->>'sessionId')::UUID<>(SELECT id FROM public.test_saved_session),'restart rotates nonce');
SELECT public.test_assert(public.test_live(1,'update',101,(SELECT jsonb_build_object('sessionId',id) FROM public.test_saved_session)||public.test_point())->>'code'='SESSION_NOT_FOUND','queued old nonce update rejected');
SELECT public.test_assert(public.test_live(1,'update',101,public.test_session()||public.test_point((SELECT started_at FROM public.test_saved_session)))->>'code'='STALE_LOCATION','old capture cannot be relabelled after restart');
SELECT public.test_assert(public.test_live(2,'read',101,public.test_session())->>'code'='CONSENT_REQUIRED','restart clears parent consent');
SELECT public.test_live(2,'consent',101,public.test_session()||'{"consent":true}');
SELECT public.test_live(1,'update',101,public.test_session()||public.test_point());
RESET ROLE;
UPDATE public.coach_live_location_sessions SET expires_at=clock_timestamp()-interval '1 second',started_at=clock_timestamp()-interval '1 hour',consented_at=clock_timestamp()-interval '1 hour';
SET ROLE service_role;
SELECT public.test_assert(public.test_live(1,'read',101,public.test_session())->>'code'='SESSION_EXPIRED','expired read denied');
SELECT public.test_live(1,'start',102,'{"consent":true}');
SELECT public.test_live(1,'update',102,public.test_session(102)||public.test_point());
SELECT public.test_live(9,'consent',102,public.test_session(102)||'{"consent":true}');
SELECT public.test_assert((SELECT count(*)=1 FROM public.parent_live_location_consents),'purge fixture has parent consent');
RESET ROLE;
UPDATE public.coach_live_location_sessions SET expires_at=clock_timestamp()-interval '1 second',started_at=clock_timestamp()-interval '1 hour',consented_at=clock_timestamp()-interval '1 hour';
SET ROLE service_role;
SELECT public.test_assert(private.purge_expired_coach_live_locations()=1,'purge removes untouched expired session');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_sessions) AND NOT EXISTS(SELECT FROM public.coach_live_locations)
    AND NOT EXISTS(SELECT FROM public.parent_live_location_consents),'purge physically deletes expired data');
SELECT public.test_assert(private.purge_expired_coach_live_locations()=0,'purge idempotent');
RESET ROLE;
UPDATE public.course_occurrences SET starts_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '16 minutes'
    WHERE id IN (public.test_uuid(101),public.test_uuid(102));
UPDATE public.coach_live_location_starts SET expires_at=clock_timestamp()-interval '1 minute';
SET ROLE service_role;
SELECT public.test_assert(private.purge_expired_coach_live_locations()=0,'receipt cleanup preserves session count');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_starts),'expired replay receipts are removed');
SELECT public.test_live(1,'start',106,'{"consent":true}');
RESET ROLE;
CREATE TABLE public.test_concurrent_session AS SELECT id FROM public.coach_live_location_sessions WHERE occurrence_id=public.test_uuid(106);
GRANT SELECT ON public.test_concurrent_session TO service_role;
SELECT count(*) AS passed_assertions FROM public.test_results;
