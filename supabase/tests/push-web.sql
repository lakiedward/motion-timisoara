\set ON_ERROR_STOP on
CREATE FUNCTION public.test_invalid(statement TEXT, label TEXT) RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
    BEGIN EXECUTE statement; EXCEPTION WHEN invalid_parameter_value THEN PERFORM public.test_assert(true,label); RETURN; END;
    RAISE EXCEPTION 'Expected invalid registration: %',label;
END; $$;
CREATE FUNCTION public.test_subscription(endpoint TEXT, p256dh TEXT DEFAULT repeat('B',87), auth TEXT DEFAULT repeat('a',22)) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT format('{"endpoint":%s,"keys":{"p256dh":%s,"auth":%s}}', to_jsonb(endpoint), to_jsonb(p256dh), to_jsonb(auth));
$$;
UPDATE private.push_deliveries SET state='sent',lease_id=NULL,lease_until=NULL WHERE state IN('pending','sending');
INSERT INTO public.profiles VALUES(public.test_uuid(7),'PARENT',true);
INSERT INTO auth.sessions VALUES(public.test_uuid(107),public.test_uuid(7),NULL);
INSERT INTO public.courses(id,club_id,active) VALUES(public.test_uuid(120),public.test_uuid(10),false);
INSERT INTO public.children VALUES(public.test_uuid(37),public.test_uuid(7));
INSERT INTO public.enrollments(child_id,kind,entity_id,status) VALUES(public.test_uuid(37),'COURSE',public.test_uuid(120),'ACTIVE');

SELECT public.test_assert(NOT EXISTS(SELECT FROM pg_proc WHERE proname='register_push_device' AND pg_get_function_identity_arguments(oid)='p_installation_id uuid, p_binding_id uuid, p_token text'),'old three-argument registration replaced');
SELECT public.test_assert(has_function_privilege('authenticated','public.register_push_device(uuid,uuid,text,text)','EXECUTE'),'parents can register web devices');
SELECT public.test_assert(NOT has_function_privilege('anon','public.register_push_device(uuid,uuid,text,text)','EXECUTE'),'anon cannot register devices');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.prepare_push_delivery(uuid,uuid)','EXECUTE'),'parents cannot prepare deliveries');
SELECT public.test_assert(has_function_privilege('service_role','public.prepare_push_delivery(uuid,uuid)','EXECUTE'),'dispatcher can still prepare deliveries');
SELECT public.test_assert(NOT has_function_privilege('authenticated','private.web_push_subscription_valid(text)','EXECUTE'),'validator stays private');
SELECT public.test_assert((SELECT bool_and(platform='android') FROM public.push_devices),'existing devices keep android platform');

SET ROLE authenticated;
SELECT public.test_actor(7);
SELECT public.set_my_push_enabled(true);
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('https://attacker.test/push/abc'),'web')$s$,'unknown push service host refused');
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('http://fcm.googleapis.com/fcm/send/abc'),'web')$s$,'plain http endpoint refused');
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('https://fcm.googleapis.com.attacker.test/fcm/send/abc'),'web')$s$,'lookalike host refused');
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('https://user@fcm.googleapis.com/fcm/send/abc'),'web')$s$,'userinfo endpoint refused');
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('https://fcm.googleapis.com/fcm/send/abc',repeat('B',86)),'web')$s$,'short client key refused');
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('https://fcm.googleapis.com/fcm/send/abc',repeat('B',87),repeat('a',21)),'web')$s$,'short auth secret refused');
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),'not-json-subscription-abcdefghijklmnop','web')$s$,'non JSON web token refused');
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),'{"endpoint":"https://fcm.googleapis.com/fcm/send/abc","keys":{"p256dh":"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB","auth":"aaaaaaaaaaaaaaaaaaaaaa"},"extra":1}','web')$s$,'extra subscription fields refused');
SELECT public.test_invalid($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('https://fcm.googleapis.com/fcm/send/abc'),'ios')$s$,'unknown platform refused');
SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('https://fcm.googleapis.com/fcm/send/chrome-endpoint:APA91b_x-y'),'web');
SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),public.test_subscription('https://fcm.googleapis.com/fcm/send/chrome-endpoint:APA91b_x-y'),'web');
SELECT public.test_denied($s$SELECT public.register_push_device(public.test_uuid(207),public.test_uuid(307),'parent-seven-android-token-abcdefghijklmnop')$s$,'binding cannot switch platform');
SELECT public.test_assert((SELECT platform='web' FROM public.push_devices WHERE id=public.test_uuid(307)),'web platform recorded');
SELECT public.test_denied('SELECT token FROM public.push_devices','web subscription cannot be selected');
RESET ROLE;

SET ROLE authenticated;
SELECT public.test_actor(7);
SELECT public.register_push_device(public.test_uuid(208),public.test_uuid(308),public.test_subscription('https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk'),'web');
SELECT public.register_push_device(public.test_uuid(209),public.test_uuid(309),public.test_subscription('https://web.push.apple.com/QGuQyavXutnMH'),'web');
SELECT public.register_push_device(public.test_uuid(210),public.test_uuid(310),public.test_subscription('https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB%3d'),'web');
RESET ROLE;
SELECT public.test_assert((SELECT count(*)=4 FROM public.push_devices WHERE user_id=public.test_uuid(7) AND platform='web' AND revoked_at IS NULL),'Chrome, Firefox, Safari and Edge endpoints accepted');
UPDATE public.push_devices SET revoked_at=now() WHERE id IN(public.test_uuid(308),public.test_uuid(309),public.test_uuid(310));

INSERT INTO public.course_announcements(id,course_id,content) VALUES(public.test_uuid(95),public.test_uuid(120),'Private web content');
DO $$ DECLARE c JSONB;p JSONB;BEGIN c:=public.claim_push_deliveries();
 PERFORM public.test_assert(jsonb_array_length(c)=1,'web parent receives one delivery');
 p:=public.prepare_push_delivery((c->0->>'deliveryId')::UUID,(c->0->>'leaseId')::UUID);
 PERFORM public.test_assert(p->>'platform'='web','prepared delivery names web platform');
 PERFORM public.test_assert((p->>'token')::JSONB->>'endpoint'='https://fcm.googleapis.com/fcm/send/chrome-endpoint:APA91b_x-y','prepared delivery carries the subscription');
 PERFORM public.test_assert(p->'data'->>'bindingId'=public.test_uuid(307)::TEXT AND p->'data'->>'path'='/account/announcements','web payload keeps binding and route');
 PERFORM public.test_assert(p::TEXT NOT LIKE '%Private web content%','web payload has no private content');
 PERFORM public.finish_push_delivery((c->0->>'deliveryId')::UUID,(c->0->>'leaseId')::UUID,'invalid_token','WEBPUSH_GONE');END $$;
SELECT public.test_assert((SELECT revoked_at IS NOT NULL FROM public.push_devices WHERE id=public.test_uuid(307)),'expired browser subscription revokes device');
SELECT count(*) AS passed_assertions FROM public.test_results;
