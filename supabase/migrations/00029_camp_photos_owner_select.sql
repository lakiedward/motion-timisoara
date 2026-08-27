-- Proprietarul unei tabere își poate în sfârșit șterge pozele.
--
-- În 00025 am pus pe `storage.objects` politici de INSERT și DELETE pentru
-- `camp-photos`, plus una de citire publică. În 00027 am scos citirea publică,
-- fiindcă reintroducea listarea întregului bucket, pe care migrarea 00012 o
-- scosese dinadins. Am scos-o și n-am pus nimic în loc.
--
-- Rezultatul: ȘTERGEREA nu mai mergea deloc. Storage caută întâi rândul și abia
-- apoi îl șterge, deci fără nicio politică de SELECT primea „AccessDenied" —
-- chiar și proprietarul, chiar și pe un fișier urcat de el cu zece secunde
-- înainte. Verificat pe 2026-08-27, urcând un fișier de probă și încercând
-- să-l șterg: upload 200, delete 400 / AccessDenied.
--
-- Nimeni n-a observat fiindcă AFIȘAREA merge pe alt drum: bucketul e public,
-- deci pozele se servesc prin CDN fără RLS. Ruptă era doar administrarea.
--
-- Politica de mai jos e îngustă dinadins — legată de tabăra din prima parte a
-- căii, ca sora ei de INSERT. NU e citirea publică de dinainte: un utilizator
-- autentificat vede rândurile taberelor pe care le administrează, și atât.
-- Bucketul rămâne nelistabil pentru restul lumii.

CREATE POLICY "camp_photos_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'camp-photos'
        AND public.pot_administra_tabara(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

COMMENT ON POLICY "camp_photos_owner_select" ON storage.objects IS
    'Proprietarul taberei isi vede fisierele, ca sa le poata sterge. Citirea publica a pozelor merge prin bucketul public, nu prin RLS.';

-- NOTĂ, în afara acestei migrări: aceeași formă lipsește și la `course-photos`,
-- `activity-photos` și `club-assets` — au DELETE fără SELECT, deci probabil nici
-- acolo ștergerea nu funcționează. E dinainte de lucrul la tabere și nu se
-- atinge aici; e de verificat separat, cu acordul proprietarului.
