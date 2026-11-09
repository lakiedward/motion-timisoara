-- Vizitatorii nelogați nu mai văd toate profilurile (bug TT #1380).
--
-- `profiles_select` era `USING (true)` pentru `anon` și `authenticated`, deci
-- `GET /rest/v1/profiles` fără cont întorcea numele și rolul tuturor
-- utilizatorilor, inclusiv administratori și părinți care n-au publicat nimic.
--
-- Pentru `anon` rămân vizibile doar profilurile pe care paginile publice le
-- afișează deja:
--   * antrenorii și cluburile (rol COACH/CLUB);
--   * orice cont cu fișă de antrenor sau proprietar de club;
--   * antrenorul unui curs, unei activități, tabere sau unui concurs;
--   * părinții care au lăsat o recenzie cu comentariu (secțiunea „Părinții spun”).
-- Verificarea rulează într-o funcție SECURITY DEFINER ca să nu depindă de
-- politicile tabelelor citite și să nu intre în recursie cu RLS.
--
-- `authenticated` păstrează regula existentă: panourile de antrenor, club și
-- admin afișează numele părinților înscriși. O restrângere pe relații pentru
-- conturile logate rămâne pas separat.

CREATE OR REPLACE FUNCTION public.is_public_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.role IN ('COACH', 'CLUB')
  )
  OR EXISTS (SELECT 1 FROM public.coach_profiles cp WHERE cp.user_id = p_profile_id)
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.owner_user_id = p_profile_id)
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.coach_id = p_profile_id)
  OR EXISTS (SELECT 1 FROM public.activities a WHERE a.coach_id = p_profile_id)
  OR EXISTS (SELECT 1 FROM public.camps c WHERE c.coach_id = p_profile_id)
  OR EXISTS (SELECT 1 FROM public.competitions c WHERE c.coach_id = p_profile_id)
  OR EXISTS (
    SELECT 1 FROM public.coach_ratings r
    WHERE r.parent_id = p_profile_id AND nullif(btrim(r.comment), '') IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM public.course_ratings r
    WHERE r.parent_id = p_profile_id AND nullif(btrim(r.comment), '') IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_profile(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY profiles_select_anon ON public.profiles
  FOR SELECT TO anon
  USING ((SELECT public.is_public_profile(profiles.id)));
