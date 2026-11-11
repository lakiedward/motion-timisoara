-- Reguli de stocare pentru poze (bug TT #1397, revizia RLS din 2026-11-11).
--
-- 1. `coach-photos`: orice cont logat putea încărca, înlocui sau șterge fișiere
--    în folderul lui, fără verificare de rol. Bucketul e folosit doar pentru
--    poza antrenorului, deci scrierea cere acum rolul COACH pe un cont activ.
--    ADMIN păstrează `coach_photos_admin_all`. Citirea proprie rămâne la fel.
-- 2. Cele șapte bucket-uri publice de poze nu aveau limită de tip sau mărime
--    (doar limita globală de 50 MiB; tipul era verificat numai în aplicație).
--    Primesc acum aceleași tipuri de imagine ca bucket-urile de regulamente
--    (JPEG, PNG, WebP, GIF), fără SVG sau HTML, și cel mult 10 MiB pe fișier.
--    Aplicația urcă poze micșorate la 1600 px (sub 1 MB) cu tipul JPEG, PNG
--    sau WebP. Limita se aplică doar fișierelor noi; cele existente rămân.
-- 3. Storage API nu trece prin `reject_inactive_account`, deci un cont
--    dezactivat cu token valid mai putea scrie în `coach-photos`, pe ramura
--    antrenorului din `announcement-media` și în `child-photos`. Toate cer acum
--    un cont activ prin `get_my_role()` (profil existent, `enabled`, nesters).
--    În `child-photos` încărcarea cere rolul PARENT activ; citirea și ștergerea
--    folderului propriu rămân libere, pentru că ștergerea contului curăță pozele
--    copiilor după ce profilul a fost deja marcat ca șters.
-- 4. `competition_routes_storage_delete` compara `route.gpx_storage_path` cu
--    `route.name` (numele traseului), nu cu numele obiectului. Clauza corectă
--    folosește `objects.name`; triggerul de gardă rămâne neschimbat.
--
-- Migrația se oprește dacă bucket-urile de poze au primit între timp limite
-- sau dacă politicile înlocuite nu mai există, în loc să calce o schimbare
-- făcută după 2026-11-11.

DO $$
DECLARE
  v_missing TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id IN ('activity-photos', 'camp-photos', 'club-assets', 'coach-photos',
                 'competition-photos', 'course-photos', 'sport-photos')
      AND (file_size_limit IS NOT NULL OR allowed_mime_types IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Un bucket de poze are deja limite; verifică storage.buckets înainte de 00141';
  END IF;

  SELECT string_agg(expected.policyname, ', ') INTO v_missing
  FROM (VALUES
    ('coach_photos_owner_insert'), ('coach_photos_owner_update'), ('coach_photos_owner_delete'),
    ('child_photos_parent_all'), ('announcement_media_owner_insert'),
    ('announcement_media_owner_delete'), ('competition_routes_storage_delete')
  ) AS expected(policyname)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.policyname = expected.policyname
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Politici lipsă pe storage.objects: %; verifică starea live înainte de 00141', v_missing;
  END IF;
END $$;

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('activity-photos', 'camp-photos', 'club-assets', 'coach-photos',
             'competition-photos', 'course-photos', 'sport-photos');

DROP POLICY "coach_photos_owner_insert" ON storage.objects;
DROP POLICY "coach_photos_owner_update" ON storage.objects;
DROP POLICY "coach_photos_owner_delete" ON storage.objects;

CREATE POLICY "coach_photos_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coach-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT public.get_my_role()) = 'COACH'
  );

CREATE POLICY "coach_photos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coach-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT public.get_my_role()) = 'COACH'
  )
  WITH CHECK (
    bucket_id = 'coach-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT public.get_my_role()) = 'COACH'
  );

CREATE POLICY "coach_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coach-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT public.get_my_role()) = 'COACH'
  );

DROP POLICY "child_photos_parent_all" ON storage.objects;

CREATE POLICY "child_photos_parent_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'child-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "child_photos_parent_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'child-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "child_photos_parent_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'child-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT public.get_my_role()) = 'PARENT'
  );

CREATE POLICY "child_photos_parent_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'child-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT public.get_my_role()) = 'PARENT'
  )
  WITH CHECK (
    bucket_id = 'child-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT public.get_my_role()) = 'PARENT'
  );

DROP POLICY "announcement_media_owner_insert" ON storage.objects;
DROP POLICY "announcement_media_owner_delete" ON storage.objects;

CREATE POLICY "announcement_media_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'announcement-media'
    AND (SELECT public.get_my_role()) IS NOT NULL
    AND (
      public.safe_uuid((storage.foldername(name))[1]) IN (
        SELECT ca.id
        FROM public.course_announcements ca
        JOIN public.courses c ON ca.course_id = c.id
        WHERE c.coach_id = (SELECT auth.uid())
      )
      OR public.safe_uuid((storage.foldername(name))[1]) IN (
        SELECT club_announcements.id
        FROM public.club_announcements
        WHERE club_announcements.club_id IN (SELECT public.my_club_ids())
      )
      OR (SELECT public.get_my_role()) = 'ADMIN'
    )
  );

CREATE POLICY "announcement_media_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'announcement-media'
    AND (SELECT public.get_my_role()) IS NOT NULL
    AND (
      public.safe_uuid((storage.foldername(name))[1]) IN (
        SELECT ca.id
        FROM public.course_announcements ca
        JOIN public.courses c ON ca.course_id = c.id
        WHERE c.coach_id = (SELECT auth.uid())
      )
      OR public.safe_uuid((storage.foldername(name))[1]) IN (
        SELECT club_announcements.id
        FROM public.club_announcements
        WHERE club_announcements.club_id IN (SELECT public.my_club_ids())
      )
      OR (SELECT public.get_my_role()) = 'ADMIN'
    )
  );

DROP POLICY "competition_routes_storage_delete" ON storage.objects;

CREATE POLICY "competition_routes_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'competition-routes'
    AND public.pot_administra_concurs(public.safe_uuid((storage.foldername(objects.name))[1]))
    AND NOT EXISTS (
      SELECT 1 FROM public.competition_routes route
      WHERE route.gpx_storage_path = objects.name
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.competition_registrations registration
      WHERE registration.gpx_storage_path_snapshot = objects.name
    )
  );
