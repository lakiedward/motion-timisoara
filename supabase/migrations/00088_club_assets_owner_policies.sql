-- Fișierele unui club (logo, copertă) pot fi scrise doar de clubul lor.
--
-- Din 00004, politicile de INSERT/UPDATE/DELETE pe bucketul `club-assets`
-- verificau doar rolul (CLUB sau ADMIN), nu și că folderul {club_id} din cale
-- e al clubului care scrie. Orice cont CLUB putea urca, suprascrie sau șterge
-- fișiere în folderul altui club. Rândul celuilalt club rămânea protejat de RLS
-- pe `clubs`, dar fișierele lui nu.
--
-- În plus, bucketul nu mai avea nicio politică de SELECT (citirea publică a fost
-- scoasă în 00012). Storage caută rândul înainte să-l șteargă, deci fără SELECT
-- ștergerea nu găsea obiectul: logo-ul sau coperta înlocuite rămâneau orfane.
-- Aceeași problemă rezolvată pentru `camp-photos` în 00029.
--
-- Politicile noi leagă toate cele patru operații de primul segment al căii
-- (`{club_id}/logo/...`, `{club_id}/hero/...`) prin `my_club_ids()`. ADMIN își
-- păstrează accesul de dinainte. SELECT-ul e îngust dinadins: un club își vede
-- doar propriile fișiere; afișarea publică merge în continuare prin bucketul
-- public, fără RLS, iar bucketul rămâne nelistabil pentru restul lumii.

DROP POLICY IF EXISTS "club_assets_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "club_assets_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "club_assets_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "club_assets_owner_select" ON storage.objects;

CREATE POLICY "club_assets_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'club-assets'
        AND (
            public.safe_uuid((storage.foldername(name))[1]) IN (SELECT public.my_club_ids())
            OR public.get_my_role() = 'ADMIN'
        )
    );

CREATE POLICY "club_assets_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'club-assets'
        AND (
            public.safe_uuid((storage.foldername(name))[1]) IN (SELECT public.my_club_ids())
            OR public.get_my_role() = 'ADMIN'
        )
    );

CREATE POLICY "club_assets_owner_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'club-assets'
        AND (
            public.safe_uuid((storage.foldername(name))[1]) IN (SELECT public.my_club_ids())
            OR public.get_my_role() = 'ADMIN'
        )
    )
    WITH CHECK (
        bucket_id = 'club-assets'
        AND (
            public.safe_uuid((storage.foldername(name))[1]) IN (SELECT public.my_club_ids())
            OR public.get_my_role() = 'ADMIN'
        )
    );

CREATE POLICY "club_assets_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'club-assets'
        AND (
            public.safe_uuid((storage.foldername(name))[1]) IN (SELECT public.my_club_ids())
            OR public.get_my_role() = 'ADMIN'
        )
    );

COMMENT ON POLICY "club_assets_owner_select" ON storage.objects IS
    'Clubul isi vede propriile fisiere, ca sa le poata sterge. Citirea publica merge prin bucketul public, nu prin RLS.';
