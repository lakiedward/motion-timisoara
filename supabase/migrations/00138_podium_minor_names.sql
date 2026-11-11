-- Podiumul public arată copiii cu prenumele și inițiala numelui.
--
-- To-Do TT #391. `get_published_competition_podium` (00073) e SECURITY DEFINER,
-- are EXECUTE pentru anon și întoarce numele complet al fiecărui participant de
-- pe podiumul publicat, deci și al copiilor. Decizia proprietarului (card
-- 2026-11-11 09:17Z, „Prenume + inițiala”): public, un copil apare ca
-- „Ana Maria I.”, adulții rămân cu numele complet, iar organizatorul vede în
-- continuare numele complete în panoul lui (`get_competition_podium_candidates`,
-- neschimbată).
--
-- Copil = înscriere cu `child_id` sau participant sub 18 ani la înscriere. Numele
-- e un singur câmp liber: se păstrează toate cuvintele în afară de ultimul, din
-- care rămâne doar prima literă urmată de punct. Un nume dintr-un singur cuvânt
-- rămâne așa cum e. Semnătura, granturile și ordinea rândurilor nu se schimbă,
-- deci aplicația nu are nevoie de altă versiune.
--
-- Migrația se oprește dacă sursa live a funcției nu mai e cea verificată pe
-- 2026-11-11 (md5 `c47a0cdb7ba690a32a3fe20c48501aef`, textul din 00073), în loc
-- să calce o schimbare făcută între timp.

DO $$
DECLARE
    v_function_md5 TEXT;
BEGIN
    SELECT md5(p.prosrc) INTO v_function_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_published_competition_podium';

    IF v_function_md5 IS DISTINCT FROM 'c47a0cdb7ba690a32a3fe20c48501aef' THEN
        RAISE EXCEPTION 'get_published_competition_podium nu mai e cea din 00073 (md5 %). Recitește-o înainte de 00138.',
            v_function_md5;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_published_competition_podium(p_competition_id UUID)
RETURNS TABLE (
    category_id UUID,
    place INTEGER,
    participant_name TEXT,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT result.category_id, result.place,
        CASE
            WHEN enrollment.child_id IS NULL
             AND registration.age_at_registration >= 18
                THEN adult.name
            WHEN cardinality(display.parts) < 2
                THEN NULLIF(display.parts[1], '')
            ELSE array_to_string(display.parts[1:cardinality(display.parts) - 1], ' ')
                || ' ' || left(display.parts[cardinality(display.parts)], 1) || '.'
        END,
        publication.published_at, result.updated_at
    FROM public.competition_podium_results result
    JOIN public.competition_podium_publications publication
      ON publication.category_id = result.category_id
     AND publication.competition_id = result.competition_id
    JOIN public.competition_registrations registration
      ON registration.id = result.registration_id
    JOIN public.enrollments enrollment
      ON enrollment.id = registration.enrollment_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    CROSS JOIN LATERAL (
        SELECT regexp_split_to_array(
            regexp_replace(COALESCE(child.name, adult.name, ''), '^\s+|\s+$', '', 'g'),
            '\s+'
        ) AS parts
    ) display
    WHERE result.competition_id = p_competition_id
      AND enrollment.status = 'ACTIVE'
    ORDER BY result.category_id, result.place
$$;

REVOKE ALL ON FUNCTION public.get_published_competition_podium(UUID)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_competition_podium(UUID)
    TO anon, authenticated;
