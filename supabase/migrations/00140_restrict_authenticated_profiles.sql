-- Conturile logate nu mai văd toate profilurile (bug TT #1396).
--
-- După 00135, `profiles_select` pentru `authenticated` a rămas `USING (true)`:
-- orice cont, chiar și un părinte abia înregistrat, citea numele și rolul
-- tuturor utilizatorilor, inclusiv ale administratorilor.
--
-- Un cont logat vede acum un profil doar dacă:
--   * e propriul profil;
--   * e public (`is_public_profile`, aceeași regulă ca pentru vizitatori:
--     antrenori, cluburi, antrenorul unei oferte, părinți cu recenzie);
--   * e adultul unei înscrieri pe care contul o poate deja vedea (organizatorul
--     taberei, al cursului, al activității sau al concursului);
--   * e autorul unui anunț de curs pe care contul îl poate deja citi;
--   * contul e administrator.
-- Ultimele două ramuri folosesc politicile existente ale tabelelor `enrollments`
-- și `course_announcements`, deci nu dau acces la nimic ce contul nu vedea deja.
-- Coloanele permise (`id, name, role, avatar_url`) și politica pentru `anon`
-- rămân neschimbate.
--
-- Migrația se oprește dacă politica live nu mai e cea verificată pe 2026-11-11
-- (`authenticated`, `USING (true)`), în loc să calce o schimbare făcută între timp.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_select' AND cmd = 'SELECT'
      AND roles = '{authenticated}'::name[] AND qual = 'true'
  ) THEN
    RAISE EXCEPTION 'profiles_select nu mai este USING (true) pentru authenticated; verifică politica live înainte de 00140';
  END IF;
END $$;

DROP POLICY profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.get_my_role()) = 'ADMIN'
    OR (SELECT public.is_public_profile(profiles.id))
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.adult_profile_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM public.course_announcements a
      WHERE a.author_user_id = profiles.id
    )
  );
