\set ON_ERROR_STOP on
CREATE FUNCTION public.test_camp(actor INTEGER,action TEXT,camp INTEGER DEFAULT 301,extra JSONB DEFAULT '{}')
RETURNS JSONB LANGUAGE sql AS $$
    SELECT public.coach_live_location_transaction(public.test_uuid(actor),
        jsonb_build_object('action',action,'campId',public.test_uuid(camp)) ||
        CASE WHEN action IN ('participants','arrive','depart') THEN '{}'::JSONB
            ELSE jsonb_build_object('coachId',public.test_uuid(1)) END ||
        CASE WHEN action='start' THEN jsonb_build_object('requestId',gen_random_uuid())
            WHEN action='consent' THEN jsonb_build_object('expectedVersion',(SELECT coalesce(max(version),0)
                FROM public.parent_live_location_consents WHERE session_id=(extra->>'sessionId')::UUID AND parent_id=public.test_uuid(actor)))
            ELSE '{}'::JSONB END || extra)
$$;
CREATE FUNCTION public.test_camp_session(camp INTEGER DEFAULT 301,coach INTEGER DEFAULT 1)
RETURNS JSONB LANGUAGE sql AS $$
    SELECT jsonb_build_object('sessionId',id) FROM public.coach_live_location_sessions
        WHERE camp_id=public.test_uuid(camp) AND coach_id=public.test_uuid(coach)
$$;
CREATE FUNCTION public.test_camp_list(actor INTEGER,camp INTEGER DEFAULT 301)
RETURNS JSONB LANGUAGE sql AS $$
    SELECT coalesce(jsonb_agg(item),'[]'::JSONB)
    FROM jsonb_array_elements(public.coach_live_location_transaction(public.test_uuid(actor),'{"action":"list"}')->'sessions') item
    WHERE item->>'campId'=public.test_uuid(camp)::TEXT
$$;
SELECT public.test_assert((SELECT relrowsecurity FROM pg_class WHERE oid='public.camp_participation'::regclass),'camp participation enables RLS');
SELECT public.test_assert(NOT has_table_privilege('anon','public.camp_participation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_table_privilege('authenticated','public.camp_participation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),'camp participation has no direct client privileges');
SELECT public.test_assert(NOT has_function_privilege('anon','public.coach_live_location_transaction(uuid,jsonb)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.coach_live_location_transaction(uuid,jsonb)','EXECUTE'),'extended RPC remains service only');
GRANT INSERT ON public.test_results TO authenticated;
SET ROLE service_role;
SELECT public.test_assert(public.coach_live_location_transaction(public.test_uuid(2),'{"action":"list"}')->>'success'='true','list succeeds without a supplied target');
SELECT public.test_assert(public.test_camp_list(2)='[]'::JSONB,'no announcement exists before explicit start');
SELECT public.test_assert(public.test_camp(1,'participants')->>'success'='true','owner can read arrival roster');
SELECT public.test_assert(public.test_camp(2,'participants')->>'code'='FORBIDDEN','parent cannot enumerate children roster');
SELECT public.test_assert(public.test_camp(3,'participants')->>'code'='FORBIDDEN','pending invite cannot enumerate roster');
SELECT public.test_assert(public.test_camp(1,'arrive',301,jsonb_build_object('enrollmentId',public.test_uuid(2202)))->>'success'='false','pending enrollment cannot arrive');
SELECT public.test_assert(public.test_camp(1,'arrive',301,jsonb_build_object('enrollmentId',public.test_uuid(1201)))->>'success'='false','course enrollment cannot arrive at camp');
SELECT public.test_assert(public.test_camp(1,'arrive',301,jsonb_build_object('enrollmentId',public.test_uuid(2203)))->>'success'='false','arrival is bound to camp');
SELECT public.test_assert(public.test_camp(2,'arrive',301,jsonb_build_object('enrollmentId',public.test_uuid(2201)))->>'code'='FORBIDDEN','parent cannot grant their own arrival');
SELECT public.test_assert(public.test_camp(3,'arrive',301,jsonb_build_object('enrollmentId',public.test_uuid(2201)))->>'code'='FORBIDDEN','pending coach cannot mark arrival');
SELECT public.test_assert(public.test_camp(1,'arrive',301,jsonb_build_object('enrollmentId',public.test_uuid(2201)))->>'success'='true','owner confirms active child arrival');
SELECT public.test_assert(public.test_camp(1,'arrive',301,jsonb_build_object('enrollmentId',public.test_uuid(2201)))->>'success'='true','repeated arrival is idempotent');
SELECT public.test_assert((SELECT count(*)=1 FROM public.camp_participation WHERE enrollment_id=public.test_uuid(2201)),'arrival has one durable row');
SELECT public.test_assert((SELECT remaining_sessions=10 AND sessions_used=0 FROM public.enrollments WHERE id=public.test_uuid(2201)),'camp arrival does not debit an enrollment');
SELECT public.test_assert(public.test_camp_list(2)='[]'::JSONB,'arrival does not start capture or create announcement');
SELECT public.test_assert(public.test_camp(1,'start')->>'success'='false','coach must opt in for camp sharing');
SELECT public.test_assert(public.test_camp(1,'start',301,'{"consent":false}')->>'code'='CONSENT_REQUIRED','explicit declined coach consent cannot start camp capture');
SELECT public.test_assert(public.test_camp(2,'start',301,'{"consent":true}')->>'code'='FORBIDDEN','parent cannot start capture');
SELECT public.test_assert(public.test_camp(6,'start',302,'{"consent":true}')->>'code'='FORBIDDEN','club cannot start capture for a coach');
SELECT public.test_assert(public.test_camp(3,'start',301,jsonb_build_object('coachId',public.test_uuid(3),'consent',true))->>'code'='FORBIDDEN','pending invited coach cannot start');
SELECT public.test_assert(public.test_camp(5,'start',302,jsonb_build_object('coachId',public.test_uuid(5),'consent',true))->>'code'='FORBIDDEN','disabled accepted coach cannot start');
SELECT public.test_assert(public.test_camp(1,'start',304,'{"consent":true}')->>'success'='false','future camp cannot start capture');
SELECT public.test_assert(public.test_camp(1,'start',305,'{"consent":true}')->>'success'='false','ended camp cannot start capture');
SELECT public.test_assert(public.test_camp(1,'start',301,jsonb_build_object('requestId',public.test_uuid(8001),'consent',true))->>'success'='true','camp owner starts capture explicitly');
SELECT public.test_assert((SELECT expires_at=started_at+interval '8 hours' FROM public.coach_live_location_sessions WHERE camp_id=public.test_uuid(301)),'camp session expires after eight hours');
SELECT public.test_assert(public.test_camp(1,'start',306,'{"consent":true}')->>'success'='true','last day allows explicit capture');
SELECT public.test_assert((SELECT s.expires_at=least(s.started_at+interval '8 hours',(c.period_end+1)::TIMESTAMP AT TIME ZONE 'Europe/Bucharest')
    FROM public.coach_live_location_sessions s JOIN public.camps c ON c.id=s.camp_id WHERE c.id=public.test_uuid(306)),'expiry clamps to camp midnight in Bucharest');
SELECT public.test_camp(1,'stop',306,public.test_camp_session(306));
SELECT public.test_assert(public.test_camp(1,'start',302,jsonb_build_object('requestId',public.test_uuid(8001),'consent',true))->>'code'='INVALID_REQUEST','start receipt cannot cross camp targets');
SELECT public.test_assert(public.test_camp(1,'start',301,jsonb_build_object('requestId',public.test_uuid(8001),'consent',true))->>'sessionId'=public.test_camp_session()->>'sessionId','retry preserves active camp session');
SELECT public.test_assert(public.test_camp(1,'update',301,public.test_camp_session()||public.test_point())->>'success'='true','owner supplies current camp point');
SELECT public.test_assert(public.test_camp(2,'read',301,public.test_camp_session())->>'code'='CONSENT_REQUIRED','arrived parent requires location consent');
SELECT public.test_assert(jsonb_array_length(public.test_camp_list(2))=1,'active announcement is discoverable before parent consent');
SELECT public.test_assert(public.test_camp_list(8)='[]'::JSONB,'pending enrollment parent cannot discover active announcement');
SELECT public.test_assert(public.test_camp_list(10)='[]'::JSONB,'unrelated parent cannot discover active announcement');
SELECT public.test_assert(NOT(public.test_camp_list(2)::TEXT ~ '"(latitude|longitude|accuracy|location|capturedAt)"'),'announcement metadata contains no coordinates or point');
SELECT set_config('realtime.topic','coach-live-location:'||(public.test_camp_session()->>'sessionId'),false);
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',public.test_uuid(1)::TEXT,false);
SELECT public.test_assert((SELECT count(*)>0 FROM realtime.messages),'actual Realtime RLS permits camp owner empty invalidations');
SELECT set_config('request.jwt.claim.sub',public.test_uuid(2)::TEXT,false);
SELECT public.test_assert((SELECT count(*)>0 FROM realtime.messages),'actual Realtime RLS permits arrived parent before location consent');
SELECT set_config('request.jwt.claim.sub',public.test_uuid(8)::TEXT,false);
SELECT public.test_assert((SELECT count(*)=0 FROM realtime.messages),'actual Realtime RLS denies parent without active arrival');
SELECT set_config('request.jwt.claim.sub',public.test_uuid(3)::TEXT,false);
SELECT public.test_assert((SELECT count(*)=0 FROM realtime.messages),'actual Realtime RLS denies pending invited coach');
RESET ROLE;
SET ROLE service_role;
SELECT public.test_assert(public.test_camp(2,'consent',301,public.test_camp_session()||'{"consent":true}')->>'success'='true','eligible parent gives session consent');
SELECT public.test_assert((public.test_camp(2,'read',301,public.test_camp_session())->'location'->>'latitude')::NUMERIC=45.75,'consented arrived parent reads camp point');
SELECT public.test_assert(public.test_camp(2,'update',301,public.test_camp_session()||public.test_point())->>'code'='FORBIDDEN','parent cannot publish coordinates');
SELECT public.test_assert(public.test_camp(2,'consent',301,public.test_camp_session()||'{"consent":false}')->>'success'='true','parent can revoke camp consent');
SELECT public.test_assert(public.test_camp(2,'consent',301,public.test_camp_session()||'{"consent":true,"expectedVersion":0}')->>'code'='REQUEST_CONFLICT','late camp consent cannot override revocation');
SELECT public.test_assert(public.test_camp(2,'read',301,public.test_camp_session())->>'code'='CONSENT_REQUIRED','revoked parent loses point access');
SELECT public.test_camp(2,'consent',301,public.test_camp_session()||'{"consent":true}');
RESET ROLE;
UPDATE public.enrollments SET status='CANCELLED' WHERE id=public.test_uuid(2201);
SET ROLE service_role;
SELECT public.test_assert(public.test_camp(2,'read',301,public.test_camp_session())->>'code'='NOT_ELIGIBLE','cancelled camp enrollment revokes read');
SELECT public.test_assert(public.test_camp_list(2)='[]'::JSONB,'cancelled enrollment removes active announcement');
SELECT public.test_assert((SELECT NOT granted AND version=4 FROM public.parent_live_location_consents WHERE session_id=(public.test_camp_session()->>'sessionId')::UUID AND parent_id=public.test_uuid(2)),'cancelling last eligible enrollment revokes consent and advances version');
RESET ROLE;
UPDATE public.enrollments SET status='ACTIVE' WHERE id=public.test_uuid(2201);
SET ROLE service_role;
SELECT public.test_assert(public.test_camp(2,'read',301,public.test_camp_session())->>'code'='CONSENT_REQUIRED','reactivating enrollment does not restore earlier location consent');
SELECT public.test_assert(public.test_camp(2,'consent',301,public.test_camp_session()||'{"consent":true,"expectedVersion":3}')->>'code'='REQUEST_CONFLICT','grant queued before cancellation cannot restore revoked consent');
SELECT public.test_assert(public.test_camp(2,'consent',301,public.test_camp_session()||'{"consent":true,"expectedVersion":4}')->>'success'='true','reactivated parent explicitly grants current consent version');
SELECT public.test_assert(public.test_camp(1,'depart',301,jsonb_build_object('enrollmentId',public.test_uuid(2201)))->>'success'='true','owner confirms departure');
SELECT public.test_assert(public.test_camp(2,'read',301,public.test_camp_session())->>'code'='NOT_ELIGIBLE','departure immediately revokes point access');
SELECT public.test_assert(public.test_camp_list(2)='[]'::JSONB,'departure removes active announcement');
SELECT public.test_assert((SELECT NOT granted AND version=6 FROM public.parent_live_location_consents WHERE session_id=(public.test_camp_session()->>'sessionId')::UUID AND parent_id=public.test_uuid(2)),'departure of last eligible child automatically revokes consent');
SELECT public.test_assert(public.test_camp(2,'status',301)->>'success'='true','departed parent can discover existing consent for revocation');
SELECT public.test_assert(public.test_camp(2,'consent',301,public.test_camp_session()||'{"consent":false}')->>'success'='true','departed parent can revoke prior consent');
SELECT public.test_camp(1,'arrive',301,jsonb_build_object('enrollmentId',public.test_uuid(2201)));
SELECT public.test_assert((SELECT departed_at IS NOT NULL FROM public.camp_participation WHERE enrollment_id=public.test_uuid(2201)),'delayed arrival cannot readmit departed child');
SELECT public.test_assert(public.test_camp(2,'read',301,public.test_camp_session())->>'code'='NOT_ELIGIBLE','arrival replay does not restore parent access');
SELECT public.test_assert(public.test_camp(6,'arrive',302,jsonb_build_object('enrollmentId',public.test_uuid(2203)))->>'success'='true','owning club confirms arrival');
SELECT public.test_assert(public.test_camp(7,'participants',302)->>'code'='FORBIDDEN','foreign club cannot read camp roster');
SELECT public.test_assert(public.test_camp(1,'start',302,'{"consent":true}')->>'success'='true','accepted invited coach starts club camp sharing');
SELECT public.test_assert(public.test_camp(3,'start',302,jsonb_build_object('coachId',public.test_uuid(3),'consent',true))->>'success'='true','second accepted coach can start own session');
SELECT public.test_assert((SELECT count(*)=2 FROM public.coach_live_location_sessions WHERE camp_id=public.test_uuid(302)),'camp coaches have independent active sessions');
SELECT public.test_assert(jsonb_array_length(public.test_camp_list(2,302))=2,'parent discovers both camp coach announcements');
SELECT public.test_assert(public.test_camp(6,'read',302,public.test_camp_session(302))->>'success'='true','owning club reads camp session');
SELECT public.test_assert(public.test_camp(7,'read',302,public.test_camp_session(302))->>'code'='FORBIDDEN','foreign club cannot read camp point');
SELECT public.test_assert(public.test_camp(3,'stop',302,public.test_camp_session(302))->>'code'='FORBIDDEN','accepted coach cannot stop another coach sharing');
SELECT public.test_assert(public.test_camp(6,'update',302,public.test_camp_session(302)||public.test_point())->>'code'='FORBIDDEN','owning club cannot publish a coach point');
SELECT public.test_assert(public.test_camp(1,'read',301,public.test_camp_session(302))->>'code'='SESSION_NOT_FOUND','session nonce cannot cross camps');
RESET ROLE;
UPDATE public.camp_coaches SET status='invited' WHERE camp_id=public.test_uuid(302) AND coach_profile_id=public.test_uuid(403);
SET ROLE service_role;
SELECT public.test_assert(public.test_camp(3,'update',302,public.test_camp_session(302,3)||public.test_point()||jsonb_build_object('coachId',public.test_uuid(3)))->>'success'='false','withdrawn coach invitation revokes update');
SELECT public.test_assert(jsonb_array_length(public.test_camp_list(2,302))=1,'withdrawn coach is removed from announcements');
DO $$ DECLARE target JSONB := public.test_camp_session(302,3)||jsonb_build_object('coachId',public.test_uuid(3)); result JSONB; BEGIN
    result := public.test_camp(3,'stop',302,target);
    PERFORM public.test_assert(result->>'success'='true' OR result->>'code'='SESSION_EXPIRED','withdrawn coach can clean up their own capture');
    PERFORM public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_sessions WHERE camp_id=public.test_uuid(302) AND coach_id=public.test_uuid(3)),'withdrawn coach stop physically removes their session');
    PERFORM public.test_assert(public.test_camp(3,'stop',302,target)->>'code'='SESSION_NOT_FOUND','withdrawn coach repeat stop confirms no session');
END $$;
SELECT public.test_assert(public.test_camp(1,'stop',301,public.test_camp_session())->>'success'='true','owner stops camp sharing');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_locations l JOIN public.coach_live_location_sessions s ON s.id=l.session_id WHERE s.camp_id=public.test_uuid(301)),'stop removes current camp point');
SELECT public.test_assert(public.test_camp(1,'start',301,jsonb_build_object('requestId',public.test_uuid(8001),'consent',true))->>'code'='SESSION_NOT_FOUND','receipt replay cannot restart stopped camp capture');
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_sessions WHERE camp_id=public.test_uuid(301)),'stopped session remains absent after replay');
SELECT public.test_assert(public.test_camp_list(1)='[]'::JSONB,'stop removes coach announcement');
SELECT public.test_assert(public.test_camp(1,'start',301,jsonb_build_object('requestId',public.test_uuid(8002),'consent',true))->>'success'='true','new request starts a fresh camp session');
SELECT public.test_camp(1,'stop',301,public.test_camp_session());
RESET ROLE;
UPDATE public.coach_live_location_starts SET expires_at=clock_timestamp()-interval '1 second' WHERE id=public.test_uuid(8002);
SET ROLE service_role;
SELECT private.purge_expired_coach_live_locations();
SELECT public.test_assert(public.test_camp(1,'start',301,jsonb_build_object('requestId',public.test_uuid(8002),'consent',true))->>'code'='SESSION_NOT_FOUND','purge retains expired capture receipt until camp end to reject delayed replay');
SELECT public.test_assert((SELECT bool_and(payload='{}'::JSONB AND event='invalidate' AND private) FROM realtime.messages WHERE topic LIKE 'coach-live-location:%'),'realtime sends private empty invalidations without locations');
\i /tmp/camp-live-location-consent.sql
RESET ROLE;
UPDATE public.coach_live_location_sessions SET started_at=clock_timestamp()-interval '9 hours',consented_at=clock_timestamp()-interval '9 hours',expires_at=clock_timestamp()-interval '1 second' WHERE camp_id IS NOT NULL;
SET ROLE service_role;
SELECT public.test_assert(public.test_camp_list(2,302)='[]'::JSONB,'expiry removes camp announcements');
SELECT private.purge_expired_coach_live_locations();
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.coach_live_location_sessions WHERE camp_id IS NOT NULL),'scheduled purge deletes expired camp sessions');
RESET ROLE;
SELECT count(*) AS passed_assertions FROM public.test_results;
