-- ============================================================
-- Vizitatorii nelogați nu mai citesc emailul brut al clubului.
--
-- Bug #1186. Se aplică după 00091 și după ce frontendul care citește
-- `public_email` e live. Utilizatorii logați își păstrează grantul pe
-- `email` (adminul îl folosește în lista de cluburi); proprietarul își
-- citește rândul prin `my_club()`.
--
-- Tot aici: `cheama_purge_expired_media()` e SECURITY DEFINER și cheamă
-- funcția de curățenie cu cheia de serviciu. O rulează doar jobul cron
-- `curatenie-media-expirata` (ca postgres), deci nu trebuie expusă prin
-- `/rest/v1/rpc` către anon sau authenticated.
-- ============================================================

REVOKE SELECT (email) ON public.clubs FROM anon;

REVOKE EXECUTE ON FUNCTION public.cheama_purge_expired_media() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
