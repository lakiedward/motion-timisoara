-- Anunțurile clubului primesc o țintă: tot clubul, un curs sau o activitate.
--
-- Până acum `club_announcements` avea doar `club_id`, deci un anunț nu putea fi
-- adresat părinților unui anumit curs. Coloanele de mai jos adaugă ținta, iar
-- politica de citire de la final o respectă: un părinte vede un anunț țintit doar
-- dacă are un copil înscris activ la cursul sau activitatea aceea.
--
-- `CAMP` este acceptat de constrângere ca să nu mai fie nevoie de o migrare când
-- taberele devin administrabile de club (`camps` nu are azi `club_id`), dar nu
-- este oferit în interfață.

ALTER TABLE public.club_announcements
    ADD COLUMN IF NOT EXISTS audience_kind TEXT NOT NULL DEFAULT 'CLUB',
    ADD COLUMN IF NOT EXISTS audience_id UUID;

COMMENT ON COLUMN public.club_announcements.audience_kind IS
    'Cui se adreseaza anuntul: CLUB (toti parintii clubului), COURSE, ACTIVITY sau CAMP.';
COMMENT ON COLUMN public.club_announcements.audience_id IS
    'Cursul, activitatea sau tabara tintita. Gol cand audience_kind = CLUB.';

ALTER TABLE public.club_announcements
    DROP CONSTRAINT IF EXISTS club_announcements_audience_kind_ck;
ALTER TABLE public.club_announcements
    ADD CONSTRAINT club_announcements_audience_kind_ck
    CHECK (audience_kind IN ('CLUB', 'COURSE', 'ACTIVITY', 'CAMP'));

-- Tinta si identificatorul ei merg impreuna: „tot clubul" nu are entitate, iar
-- restul nu au sens fara una. Fara constrangerea asta, un audience_kind gresit
-- ar produce tacut un anunt pe care nu-l vede nimeni.
ALTER TABLE public.club_announcements
    DROP CONSTRAINT IF EXISTS club_announcements_audience_id_ck;
ALTER TABLE public.club_announcements
    ADD CONSTRAINT club_announcements_audience_id_ck
    CHECK (
        (audience_kind = 'CLUB' AND audience_id IS NULL)
        OR (audience_kind <> 'CLUB' AND audience_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS club_announcements_audience_idx
    ON public.club_announcements (audience_kind, audience_id);

-- ============================================================================
-- Citirea
--
-- Politica veche acorda `select` si lui `anon` pentru ORICE anunt activ, deci un
-- anunt de tipul „Sedinta cu parintii, vineri la 18:00, la bazin" era lizibil de
-- pe internet. Nicio pagina nu-l citea, deci nu se pierde niciun comportament
-- existent — dar pe o platforma despre copii, expunerea implicita se restrange,
-- nu se pastreaza. Anunturile ajung acum la:
--   * clubul care le-a scris (neschimbat, isi vede si ascunsele si programatele);
--   * ADMIN (neschimbat);
--   * parintii cu un copil inscris activ, dupa tinta anuntului.
-- ============================================================================

DROP POLICY IF EXISTS "club_announcements_select" ON public.club_announcements;

CREATE POLICY "club_announcements_select" ON public.club_announcements
    FOR SELECT TO authenticated
    USING (
        club_id IN (SELECT my_club_ids())
        OR (SELECT get_my_role()) = 'ADMIN'
        OR (
            is_active = TRUE
            AND (publish_at IS NULL OR publish_at <= now())
            AND (expires_at IS NULL OR expires_at > now())
            AND (
                CASE
                    -- Tot clubul: parintele are un copil inscris activ la orice
                    -- curs sau activitate a clubului care a scris anuntul.
                    WHEN audience_kind = 'CLUB' THEN EXISTS (
                        SELECT 1
                        FROM public.enrollments e
                        JOIN public.children ch ON ch.id = e.child_id
                        LEFT JOIN public.courses co
                            ON e.kind = 'COURSE' AND co.id = e.entity_id
                        LEFT JOIN public.activities ac
                            ON e.kind = 'ACTIVITY' AND ac.id = e.entity_id
                        WHERE ch.parent_id = (SELECT auth.uid())
                          AND e.status = 'ACTIVE'
                          AND COALESCE(co.club_id, ac.club_id) = club_announcements.club_id
                    )
                    -- Tintit: inscriere activa exact pe entitatea aceea.
                    ELSE EXISTS (
                        SELECT 1
                        FROM public.enrollments e
                        JOIN public.children ch ON ch.id = e.child_id
                        WHERE ch.parent_id = (SELECT auth.uid())
                          AND e.status = 'ACTIVE'
                          AND e.kind = club_announcements.audience_kind
                          AND e.entity_id = club_announcements.audience_id
                    )
                END
            )
        )
    );
