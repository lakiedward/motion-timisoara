-- Podiumul publicat îl corectează doar organizatorul, iar staff-ul concursului
-- nu mai citește data nașterii adulților înscriși.
--
-- Bug TT #1368 (review RLS concursuri, To-Do #312). `can_edit_competition_podium`
-- (00073) lasă organizatorul și orice antrenor cu invitație acceptată să
-- insereze, să schimbe și să șteargă locuri după încheierea concursului, fără să
-- verifice publicarea. Publicarea e doar a organizatorului, dar după ea un
-- antrenor invitat putea schimba rezultatul public fără ca organizatorul să
-- știe. Decizia owner-ului (card 2026-11-06 13:17Z, „Doar organizatorul”): după
-- publicarea unei categorii, locurile ei le mai schimbă doar organizatorul
-- (`pot_administra_concurs`: clubul sau antrenorul organizator, adminul activ).
-- Categoriile încă nepublicate rămân editabile ca înainte de toți antrenorii
-- acceptați. Funcția rămâne neschimbată; condiția nouă e în politici, pe
-- categoria rândului, pentru că publicarea e pe categorie.
--
-- Bug TT #1369. `authenticated` avea SELECT pe toate coloanele din
-- `competition_registrations`, iar `competition_registrations_select` dă
-- rândurile organizatorului și antrenorilor acceptați. Astfel vedeau
-- `adult_birth_date` pentru fiecare adult înscris. Aplicația nu citește coloana
-- (vârsta e în `age_at_registration`), iar edge functions o citesc ca
-- service_role. Grantul pe tabel devine grant pe coloane, fără data nașterii. O
-- coloană nouă în tabel va avea nevoie de propriul GRANT.
--
-- Migrația se oprește dacă politicile, funcția sau granturile live nu mai sunt
-- cele verificate pe 2026-11-06, în loc să calce o schimbare făcută între timp.

DO $$
DECLARE
    v_policies TEXT[];
    v_function_md5 TEXT;
    v_table_privileges TEXT[];
    v_column_acls INTEGER;
BEGIN
    SELECT array_agg(policyname::TEXT || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '')
        ORDER BY policyname) INTO v_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'competition_podium_results'
      AND policyname IN ('competition_podium_results_delete', 'competition_podium_results_insert',
          'competition_podium_results_update');

    SELECT md5(p.prosrc) INTO v_function_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'can_edit_competition_podium';

    SELECT array_agg(acl.privilege_type::TEXT ORDER BY acl.privilege_type) INTO v_table_privileges
    FROM pg_class c, aclexplode(c.relacl) acl
    WHERE c.oid = 'public.competition_registrations'::regclass
      AND acl.grantee = 'authenticated'::regrole;

    SELECT count(*) INTO v_column_acls
    FROM pg_attribute
    WHERE attrelid = 'public.competition_registrations'::regclass
      AND attnum > 0 AND NOT attisdropped AND attacl IS NOT NULL;

    IF v_policies IS DISTINCT FROM ARRAY[
        'competition_podium_results_delete:can_edit_competition_podium(competition_id):',
        'competition_podium_results_insert::can_edit_competition_podium(competition_id)',
        'competition_podium_results_update:can_edit_competition_podium(competition_id):can_edit_competition_podium(competition_id)']
       OR v_function_md5 IS DISTINCT FROM '03b55ae2ebb965bbd5b716dd6fd76453'
       OR v_table_privileges IS DISTINCT FROM ARRAY['SELECT']
       OR v_column_acls <> 0 THEN
        RAISE EXCEPTION 'Podiumul sau granturile înscrierilor nu mai sunt cele din 00072/00073 (%, %, %, %). Recitește-le înainte de 00133.',
            v_policies, v_function_md5, v_table_privileges, v_column_acls;
    END IF;
END $$;

ALTER POLICY competition_podium_results_insert ON public.competition_podium_results
    WITH CHECK (
        public.can_edit_competition_podium(competition_id)
        AND (
            public.pot_administra_concurs(competition_id)
            OR NOT EXISTS (
                SELECT 1 FROM public.competition_podium_publications publication
                WHERE publication.category_id = competition_podium_results.category_id
                  AND publication.competition_id = competition_podium_results.competition_id
            )
        )
    );

ALTER POLICY competition_podium_results_update ON public.competition_podium_results
    USING (
        public.can_edit_competition_podium(competition_id)
        AND (
            public.pot_administra_concurs(competition_id)
            OR NOT EXISTS (
                SELECT 1 FROM public.competition_podium_publications publication
                WHERE publication.category_id = competition_podium_results.category_id
                  AND publication.competition_id = competition_podium_results.competition_id
            )
        )
    )
    WITH CHECK (
        public.can_edit_competition_podium(competition_id)
        AND (
            public.pot_administra_concurs(competition_id)
            OR NOT EXISTS (
                SELECT 1 FROM public.competition_podium_publications publication
                WHERE publication.category_id = competition_podium_results.category_id
                  AND publication.competition_id = competition_podium_results.competition_id
            )
        )
    );

ALTER POLICY competition_podium_results_delete ON public.competition_podium_results
    USING (
        public.can_edit_competition_podium(competition_id)
        AND (
            public.pot_administra_concurs(competition_id)
            OR NOT EXISTS (
                SELECT 1 FROM public.competition_podium_publications publication
                WHERE publication.category_id = competition_podium_results.category_id
                  AND publication.competition_id = competition_podium_results.competition_id
            )
        )
    );

REVOKE SELECT ON public.competition_registrations FROM authenticated;
GRANT SELECT (
    id, enrollment_id, competition_id, category_id, route_id, category_name_snapshot,
    route_name_snapshot, gpx_storage_path_snapshot, adult_profile_id, age_at_registration,
    accepted_price_bani, registered_at
) ON public.competition_registrations TO authenticated;
