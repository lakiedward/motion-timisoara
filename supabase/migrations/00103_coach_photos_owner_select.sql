-- Un antrenor își poate șterge poza de profil înlocuită sau scoasă.
--
-- Citirea publică a bucketului `coach-photos` a fost scoasă în 00012, ca bucketul
-- să nu fie listabil. Storage caută rândul înainte să-l șteargă, deci fără nicio
-- politică de SELECT pentru antrenor ștergerea nu găsea obiectul: poza veche
-- rămânea orfană după „Schimbă poza” sau „Scoate poza”. Aceeași reparație ca
-- pentru `camp-photos` (00029) și `club-assets` (00089).
--
-- SELECT-ul e îngust: antrenorul își vede doar folderul lui ({user_id}/...).
-- ADMIN are deja `coach_photos_admin_all`. Afișarea publică merge în continuare
-- prin bucketul public, fără RLS.

DROP POLICY IF EXISTS "coach_photos_owner_select" ON storage.objects;

CREATE POLICY "coach_photos_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'coach-photos'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );
