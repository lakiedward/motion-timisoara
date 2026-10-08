\set ON_ERROR_STOP on
\i /tmp/migration.sql
\i /tmp/provider.sql
CREATE FUNCTION public.test_assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', label; END IF; END;
$$;
SELECT public.test_assert(NOT has_table_privilege('authenticated','public.location_reverse_cache','SELECT'), 'cache is not client-readable');
SELECT public.test_assert(NOT has_table_privilege('anon','public.location_reverse_provider','UPDATE'), 'anonymous cannot acquire provider');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.claim_location_reverse(text)','EXECUTE'), 'claim is service-only');
SELECT public.test_assert(NOT has_function_privilege('anon','public.finish_location_reverse(uuid,text,jsonb)','EXECUTE'), 'finish is service-only');
SELECT public.test_assert((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.location_reverse_cache'::regclass,'public.location_reverse_provider'::regclass)), 'RLS enabled');
SELECT public.test_assert((SELECT provider = 'fallback' FROM public.location_reverse_provider), 'provider lease is independent of endpoint configuration');
SET ROLE service_role;
SELECT public.claim_location_reverse('45.75000,21.23000')->>'token' AS token \gset
SELECT public.test_assert(:'token' IS NOT NULL, 'first claim succeeds');
SELECT public.test_assert(public.claim_location_reverse('45.76000,21.24000')->>'token' IS NULL, 'second claim blocked globally');
SELECT public.finish_location_reverse(gen_random_uuid(),'45.75000,21.23000','{"address":"stale"}');
SELECT public.test_assert(public.claim_location_reverse('45.76000,21.24000')->>'token' IS NULL, 'stale token cannot release another lease');
SELECT public.finish_location_reverse(:'token'::uuid,'45.75000,21.23000','{"address":"Strada Test","city":"Timișoara","county":"Timiș"}');
SELECT public.test_assert(public.claim_location_reverse('45.75000,21.23000')->'cached'->>'address' = 'Strada Test', 'cache is usable during cooldown');
SELECT public.test_assert(public.claim_location_reverse('45.76000,21.24000')->>'token' IS NULL, 'cooldown enforced after completion');
UPDATE public.location_reverse_provider SET available_at = clock_timestamp() - interval '1 second';
UPDATE public.location_reverse_cache SET expires_at = clock_timestamp() - interval '1 second';
SELECT public.test_assert(public.claim_location_reverse('45.75000,21.23000')->>'token' IS NOT NULL, 'expired cache triggers fresh claim');
RESET ROLE;
UPDATE public.location_reverse_provider SET available_at = clock_timestamp() - interval '1 second';
\echo Location reverse SQL contracts passed.
