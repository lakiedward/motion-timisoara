-- Un antrenor apare pe pagina publică a taberei doar dacă a acceptat.
--
-- Decis cu proprietarul pe 2026-08-27, la întrebarea deschisă din feature #305:
-- „oricine poate fi invitat, dar trebuie să accepte".
--
-- Până acum `camp_coaches` accepta ORICE `coach_profile_id`, fără verificare de
-- lot și fără acord — deci un club putea pune pe pagina lui publică numele și
-- poza unui antrenor din alt club, iar acela afla ultimul. Invitația devine
-- acum o propunere, nu un fapt.
--
-- Rândurile existente sunt trecute pe `accepted` dinadins: sunt puse de mine ca
-- date de probă, înainte să existe modelul de acord, și nu are cine să le
-- accepte retroactiv. Orice invitație NOUĂ pleacă de la `invited`.

ALTER TABLE public.camp_coaches
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'invited',
    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

ALTER TABLE public.camp_coaches DROP CONSTRAINT IF EXISTS camp_coaches_status_ck;
ALTER TABLE public.camp_coaches
    ADD CONSTRAINT camp_coaches_status_ck
    CHECK (status IN ('invited', 'accepted', 'declined'));

COMMENT ON COLUMN public.camp_coaches.status IS
    'invited pana raspunde antrenorul; doar accepted ajunge pe pagina publica.';

-- Datele de proba de dinaintea modelului. Fara asta, paginile deja verificate
-- ar ramane brusc fara antrenori.
UPDATE public.camp_coaches SET status = 'accepted', responded_at = now()
WHERE status = 'invited';

CREATE INDEX IF NOT EXISTS camp_coaches_status_idx
    ON public.camp_coaches (coach_profile_id, status);

-- ============================================================================
-- Citirea
-- ============================================================================
--
-- Trei feluri de oameni văd rândul: publicul, dar numai dacă e acceptat; cine
-- administrează tabăra, ca să-și vadă invitațiile în așteptare; și antrenorul
-- invitat, ca să știe că a fost invitat. Pentru `anon`, `auth.uid()` e NULL,
-- deci ultimele două ramuri sunt goale de la sine.
DROP POLICY IF EXISTS "camp_coaches_select" ON public.camp_coaches;
CREATE POLICY "camp_coaches_select" ON public.camp_coaches
    FOR SELECT TO anon, authenticated
    USING (
        (status = 'accepted' AND camp_id IN (SELECT id FROM public.camps))
        OR public.pot_administra_tabara(camp_id)
        OR coach_profile_id IN (
            SELECT id FROM public.coach_profiles WHERE user_id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- Răspunsul la invitație
-- ============================================================================
--
-- DINADINS o funcție, nu o politică de UPDATE.
--
-- O politică `USING/WITH CHECK` pe `coach_profile_id = al meu` ar fi lăsat
-- antrenorul să-și mute propria invitație pe ALTĂ tabără: `camp_id` s-ar fi
-- schimbat, iar WITH CHECK ar fi trecut, fiindcă antrenorul rămâne el însuși.
-- Adică oricine invitat undeva s-ar fi putut adăuga, acceptat, la orice tabără.
-- RLS nu poate compara rândul vechi cu cel nou; funcția asta poate.
CREATE OR REPLACE FUNCTION public.raspunde_invitatie_tabara(
    p_camp_id UUID,
    p_accept BOOLEAN
)
RETURNS public.camp_coaches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    randul public.camp_coaches;
BEGIN
    UPDATE public.camp_coaches k
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now()
    WHERE k.camp_id = p_camp_id
      AND k.coach_profile_id IN (
          SELECT id FROM public.coach_profiles WHERE user_id = (SELECT auth.uid())
      )
    RETURNING * INTO randul;

    IF randul IS NULL THEN
        RAISE EXCEPTION 'Nu exista o invitatie pentru tine la tabara %', p_camp_id
            USING ERRCODE = 'P0001';
    END IF;

    RETURN randul;
END;
$$;

COMMENT ON FUNCTION public.raspunde_invitatie_tabara(UUID, BOOLEAN) IS
    'Antrenorul isi accepta sau refuza propria invitatie. Nu poate crea una si nu o poate muta pe alta tabara.';

REVOKE ALL ON FUNCTION public.raspunde_invitatie_tabara(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.raspunde_invitatie_tabara(UUID, BOOLEAN) TO authenticated;

-- ============================================================================
-- Scrierea de către proprietar
-- ============================================================================
--
-- Proprietarul invită și retrage invitații, dar NU poate scrie `status`: altfel
-- ar putea „accepta" în numele antrenorului, și tot acordul ar fi o formalitate.
-- Se împarte în INSERT / DELETE, fără UPDATE, în locul lui FOR ALL de dinainte.
DROP POLICY IF EXISTS "camp_coaches_write" ON public.camp_coaches;

DROP POLICY IF EXISTS "camp_coaches_owner_insert" ON public.camp_coaches;
CREATE POLICY "camp_coaches_owner_insert" ON public.camp_coaches
    FOR INSERT TO authenticated
    WITH CHECK (public.pot_administra_tabara(camp_id) AND status = 'invited');

DROP POLICY IF EXISTS "camp_coaches_owner_delete" ON public.camp_coaches;
CREATE POLICY "camp_coaches_owner_delete" ON public.camp_coaches
    FOR DELETE TO authenticated
    USING (public.pot_administra_tabara(camp_id));

GRANT SELECT ON public.camp_coaches TO anon, authenticated;
GRANT INSERT, DELETE ON public.camp_coaches TO authenticated;
REVOKE UPDATE ON public.camp_coaches FROM authenticated;
