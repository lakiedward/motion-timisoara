-- Pozele unui curs sau ale unei activități pot fi scrise și șterse doar de cine
-- le administrează.
--
-- Din 00004 (și 00077 pentru activități), politicile de INSERT/UPDATE/DELETE pe
-- bucketurile `course-photos` și `activity-photos` verificau doar rolul (COACH,
-- CLUB sau ADMIN), nu și că folderul {course_id} / {activity_id} din cale e al
-- celui care scrie. Orice antrenor sau club putea urca, suprascrie sau șterge
-- poze în folderul cursului ori activității altcuiva.
--
-- În plus, niciun bucket nu mai avea politică de SELECT (citirea publică a fost
-- scoasă în 00012). Storage caută rândul înainte să-l șteargă, deci fără SELECT
-- ștergerea nu găsea obiectul: poza hero înlocuită rămânea orfană. Aceeași
-- problemă rezolvată pentru `camp-photos` în 00029 și `club-assets` în 00089.
--
-- Politicile noi leagă operațiile de primul segment al căii
-- (`{course_id}/hero/...`, `{activity_id}/hero/...`) prin
-- `pot_administra_curs()` / `pot_administra_activitate()` din 00066: clubul
-- proprietar, antrenorul ofertei sau ADMIN. SELECT-ul e îngust dinadins:
-- afișarea publică merge în continuare prin bucketurile publice, fără RLS, iar
-- bucketurile rămân nelistabile pentru restul lumii.

DROP POLICY IF EXISTS "course_photos_coach_insert" ON storage.objects;
DROP POLICY IF EXISTS "course_photos_coach_update" ON storage.objects;
DROP POLICY IF EXISTS "course_photos_coach_delete" ON storage.objects;
DROP POLICY IF EXISTS "course_photos_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "course_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "course_photos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "course_photos_owner_delete" ON storage.objects;

DROP POLICY IF EXISTS "activity_photos_coach_insert" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_coach_delete" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "activity_photos_owner_delete" ON storage.objects;

CREATE POLICY "course_photos_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'course-photos'
        AND public.pot_administra_curs(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY "course_photos_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'course-photos'
        AND public.pot_administra_curs(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY "course_photos_owner_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'course-photos'
        AND public.pot_administra_curs(public.safe_uuid((storage.foldername(name))[1]))
    )
    WITH CHECK (
        bucket_id = 'course-photos'
        AND public.pot_administra_curs(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY "course_photos_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'course-photos'
        AND public.pot_administra_curs(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY "activity_photos_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'activity-photos'
        AND public.pot_administra_activitate(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY "activity_photos_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'activity-photos'
        AND public.pot_administra_activitate(public.safe_uuid((storage.foldername(name))[1]))
    );

CREATE POLICY "activity_photos_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'activity-photos'
        AND public.pot_administra_activitate(public.safe_uuid((storage.foldername(name))[1]))
    );

COMMENT ON POLICY "course_photos_owner_select" ON storage.objects IS
    'Cine administreaza cursul isi vede pozele, ca sa le poata sterge. Citirea publica merge prin bucketul public, nu prin RLS.';
COMMENT ON POLICY "activity_photos_owner_select" ON storage.objects IS
    'Cine administreaza activitatea isi vede pozele, ca sa le poata sterge. Citirea publica merge prin bucketul public, nu prin RLS.';
