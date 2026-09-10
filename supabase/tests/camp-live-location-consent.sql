\set ON_ERROR_STOP on
RESET ROLE;
INSERT INTO public.children VALUES(public.test_uuid(207),public.test_uuid(12),'Second child',md5(public.test_uuid(207)::TEXT));
INSERT INTO public.enrollments(id,kind,entity_id,child_id,status) VALUES
    (public.test_uuid(2406),'CAMP',public.test_uuid(306),public.test_uuid(206),'ACTIVE'),
    (public.test_uuid(2407),'CAMP',public.test_uuid(306),public.test_uuid(207),'ACTIVE');
INSERT INTO public.camp_coaches VALUES(public.test_uuid(306),public.test_uuid(403),'accepted');
SET ROLE service_role;
SELECT public.test_assert(public.test_camp(1,'start',306,'{"consent":true}')->>'success'='true','multi-child consent fixture starts explicitly');
SELECT public.test_assert(public.test_camp(3,'start',306,jsonb_build_object('consent',true,'coachId',public.test_uuid(3)))->>'success'='true','multi-child fixture has a second coach sharing');
SELECT public.test_camp(1,'arrive',306,jsonb_build_object('enrollmentId',public.test_uuid(2406)));
SELECT public.test_camp(1,'arrive',306,jsonb_build_object('enrollmentId',public.test_uuid(2407)));
SELECT public.test_assert(public.test_camp(12,'consent',306,public.test_camp_session(306)||'{"consent":true}')->>'success'='true','parent of two arrived children grants consent');
SELECT public.test_assert(public.test_camp(12,'consent',306,public.test_camp_session(306,3)||jsonb_build_object('consent',true,'coachId',public.test_uuid(3)))->>'success'='true','parent explicitly consents to second coach session');
SELECT public.test_assert(public.test_camp(1,'depart',306,jsonb_build_object('enrollmentId',public.test_uuid(2406)))->>'success'='true','first of two children departs');
SELECT public.test_assert((SELECT granted AND version=1 FROM public.parent_live_location_consents WHERE session_id=(public.test_camp_session(306)->>'sessionId')::UUID AND parent_id=public.test_uuid(12)),'one child departure preserves consent while second child remains eligible');
SELECT public.test_assert((SELECT count(*)=2 AND bool_and(pc.granted AND pc.version=1) FROM public.parent_live_location_consents pc JOIN public.coach_live_location_sessions s ON s.id=pc.session_id WHERE s.camp_id=public.test_uuid(306) AND pc.parent_id=public.test_uuid(12)),'remaining eligible child preserves both coach session consents');
SELECT public.test_assert(public.test_camp(12,'read',306,public.test_camp_session(306))->>'success'='true','second arrived child preserves parent location access');
RESET ROLE;
UPDATE public.enrollments SET status='CANCELLED' WHERE id=public.test_uuid(2407);
SET ROLE service_role;
SELECT public.test_assert((SELECT NOT granted AND version=2 FROM public.parent_live_location_consents WHERE session_id=(public.test_camp_session(306)->>'sessionId')::UUID AND parent_id=public.test_uuid(12)),'cancelling last remaining eligible child revokes multi-child parent consent');
SELECT public.test_assert((SELECT count(*)=2 AND bool_and(NOT pc.granted AND pc.version=2) FROM public.parent_live_location_consents pc JOIN public.coach_live_location_sessions s ON s.id=pc.session_id WHERE s.camp_id=public.test_uuid(306) AND pc.parent_id=public.test_uuid(12)),'loss of eligibility revokes all coach session consents in camp');
SELECT public.test_assert(public.test_camp(12,'read',306,public.test_camp_session(306))->>'code'='NOT_ELIGIBLE','no eligible child denies parent location read');
RESET ROLE;
UPDATE public.enrollments SET status='ACTIVE' WHERE id=public.test_uuid(2407);
SET ROLE service_role;
SELECT public.test_assert(public.test_camp(12,'read',306,public.test_camp_session(306))->>'code'='CONSENT_REQUIRED','returning eligibility requires a new explicit consent');
SELECT public.test_assert(public.test_camp(12,'consent',306,public.test_camp_session(306)||'{"consent":true,"expectedVersion":1}')->>'code'='REQUEST_CONFLICT','multi-child grant queued before automatic revocation conflicts');
SELECT public.test_assert(public.test_camp(12,'consent',306,public.test_camp_session(306)||'{"consent":true,"expectedVersion":2}')->>'success'='true','new explicit consent restores eligible parent read');
RESET ROLE;
DELETE FROM public.enrollments WHERE id=public.test_uuid(2407);
SET ROLE service_role;
SELECT public.test_assert(NOT EXISTS(SELECT FROM public.camp_participation WHERE enrollment_id=public.test_uuid(2407)),'deleting enrollment cascades its participation');
SELECT public.test_assert((SELECT NOT granted AND version=4 FROM public.parent_live_location_consents WHERE session_id=(public.test_camp_session(306)->>'sessionId')::UUID AND parent_id=public.test_uuid(12)),'deleting last eligible enrollment automatically revokes consent once');
SELECT public.test_assert(public.test_camp(12,'read',306,public.test_camp_session(306))->>'code'='NOT_ELIGIBLE','deleted enrollment cannot authorize location read');
RESET ROLE;
INSERT INTO public.enrollments(id,kind,entity_id,child_id,status) VALUES
    (public.test_uuid(2408),'CAMP',public.test_uuid(306),public.test_uuid(207),'ACTIVE');
SET ROLE service_role;
SELECT public.test_assert(public.test_camp(1,'arrive',306,jsonb_build_object('enrollmentId',public.test_uuid(2408)))->>'success'='true','new enrollment has its own confirmed arrival');
SELECT public.test_assert(public.test_camp(12,'read',306,public.test_camp_session(306))->>'code'='CONSENT_REQUIRED','new enrollment and arrival do not revive previous consent');
SELECT public.test_assert(public.test_camp(12,'consent',306,public.test_camp_session(306)||'{"consent":true,"expectedVersion":3}')->>'code'='REQUEST_CONFLICT','grant queued before enrollment deletion cannot revive consent');
SELECT public.test_assert(public.test_camp(12,'consent',306,public.test_camp_session(306)||'{"consent":true,"expectedVersion":4}')->>'success'='true','fresh explicit consent works after new enrollment arrival');
SELECT public.test_assert(public.test_camp(12,'read',306,public.test_camp_session(306))->>'success'='true','fresh current consent restores location access after reenrollment');
RESET ROLE;
UPDATE public.children SET parent_id=public.test_uuid(11) WHERE id=public.test_uuid(207);
SET ROLE service_role;
SELECT public.test_assert((SELECT NOT granted AND version=6 FROM public.parent_live_location_consents WHERE session_id=(public.test_camp_session(306)->>'sessionId')::UUID AND parent_id=public.test_uuid(12)),'parent transfer automatically revokes former parent consent');
SELECT public.test_assert(public.test_camp(12,'read',306,public.test_camp_session(306))->>'code'='NOT_ELIGIBLE','former parent loses read on child transfer');
SELECT public.test_assert(public.test_camp(11,'read',306,public.test_camp_session(306))->>'code'='CONSENT_REQUIRED','new parent does not inherit former parent consent');
SELECT public.test_assert(public.test_camp(11,'consent',306,public.test_camp_session(306)||'{"consent":true}')->>'success'='true','new parent explicitly consents after transfer');
RESET ROLE;
UPDATE public.parent_live_location_consents SET version=2147483647
    WHERE session_id=(public.test_camp_session(306)->>'sessionId')::UUID AND parent_id=public.test_uuid(11);
SET ROLE service_role;
SELECT public.test_assert(public.test_camp(1,'depart',306,jsonb_build_object('enrollmentId',public.test_uuid(2408)))->>'success'='true','departure at maximum consent version does not overflow');
SELECT public.test_assert((SELECT NOT granted AND version=2147483647 FROM public.parent_live_location_consents WHERE session_id=(public.test_camp_session(306)->>'sessionId')::UUID AND parent_id=public.test_uuid(11)),'maximum consent version is retained as revoked terminal state');
SELECT public.test_assert(public.test_camp(11,'consent',306,public.test_camp_session(306)||'{"consent":true,"expectedVersion":2147483646}')->>'code'='REQUEST_CONFLICT','stale grant cannot revive terminal revoked consent');
