-- Cine poate citi și scrie pozele și filmările de la antrenament.
--
-- Politica de citire de până acum era:
--     bucket_id = 'announcement-media' AND auth.uid() IS NOT NULL
-- adică ORICE cont autentificat putea citi ORICE fișier din bucket, dacă îi știa
-- calea. Oricine își poate face cont pe platformă. Pentru poze cu copii la
-- antrenament asta nu e o scăpare tehnică, e o problemă serioasă: fișierele nu
-- erau legate de curs, de club sau de vreo înscriere — doar de faptul că ești
-- logat.
--
-- Iar scrierea era deschisă doar rolurilor COACH și ADMIN, deci un club nu putea
-- încărca nimic, deși tocmai clubul e cel care ține pagina de anunțuri.
--
-- Regula nouă urmează anunțul, nu rolul: ai voie la fișier dacă ai voie la
-- anunțul de care atârnă. Calea e `announcement-media/{announcement_id}/{uuid}.{ext}`,
-- convenție scrisă în 00004, deci primul segment din cale spune de care anunț e
-- vorba. Subinterogările sunt filtrate de politicile tabelelor de anunțuri, deci
-- regula „doar părinții cursului” scrisă în 00021 se aplică și fișierelor, fără
-- s-o rescriem a doua oară.

-- Un nume de folder care nu e uuid ar face `::uuid` să arunce, iar o eroare
-- într-o politică pică toată interogarea, nu doar rândul. Aici întoarce gol.
CREATE OR REPLACE FUNCTION public.safe_uuid(t TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    RETURN t::uuid;
EXCEPTION WHEN others THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.safe_uuid(TEXT) IS
    'Converteste in uuid, sau NULL daca textul nu e un uuid. Folosita in politici, unde o eroare de conversie ar pica toata interogarea.';

GRANT EXECUTE ON FUNCTION public.safe_uuid(TEXT) TO authenticated;

DROP POLICY IF EXISTS "announcement_media_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "announcement_media_coach_insert" ON storage.objects;
DROP POLICY IF EXISTS "announcement_media_coach_delete" ON storage.objects;

CREATE POLICY "announcement_media_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'announcement-media'
        AND (
            public.safe_uuid((storage.foldername(name))[1])
                IN (SELECT id FROM public.course_announcements)
            OR public.safe_uuid((storage.foldername(name))[1])
                IN (SELECT id FROM public.club_announcements)
        )
    );

-- Scrierea ramane a celui care detine anuntul. Nu e destul sa fii COACH: trebuie
-- sa fii antrenorul ACELUI curs, altfel orice antrenor ar putea pune fisiere in
-- dosarul anuntului altcuiva.
CREATE POLICY "announcement_media_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'announcement-media'
        AND (
            public.safe_uuid((storage.foldername(name))[1]) IN (
                SELECT ca.id FROM public.course_announcements ca
                JOIN public.courses c ON ca.course_id = c.id
                WHERE c.coach_id = (SELECT auth.uid())
            )
            OR public.safe_uuid((storage.foldername(name))[1]) IN (
                SELECT id FROM public.club_announcements
                WHERE club_id IN (SELECT my_club_ids())
            )
            OR (SELECT public.get_my_role()) = 'ADMIN'
        )
    );

CREATE POLICY "announcement_media_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'announcement-media'
        AND (
            public.safe_uuid((storage.foldername(name))[1]) IN (
                SELECT ca.id FROM public.course_announcements ca
                JOIN public.courses c ON ca.course_id = c.id
                WHERE c.coach_id = (SELECT auth.uid())
            )
            OR public.safe_uuid((storage.foldername(name))[1]) IN (
                SELECT id FROM public.club_announcements
                WHERE club_id IN (SELECT my_club_ids())
            )
            OR (SELECT public.get_my_role()) = 'ADMIN'
        )
    );
