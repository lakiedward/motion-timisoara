-- Ținta unui anunț trebuie să fie a clubului care îl scrie.
--
-- Migrarea 00020 a legat anunțul de o țintă, dar ramura țintită a politicii de
-- citire corela DOAR pe `e.kind = audience_kind AND e.entity_id = audience_id`,
-- fără să ceară nicăieri ca acel curs sau acea activitate să aparțină clubului
-- care a scris anunțul. Ramura „tot clubul" verifica apartenența; cea țintită, nu.
--
-- Consecința, reprodusă cap-coadă: oricine își face un club (`clubs_insert` nu
-- are poartă de rol), citește id-ul unui curs activ al altui club (`courses_select`
-- e deschisă lui `anon`) și publică un anunț țintit pe el. Anunțul aterizează în
-- lista de anunțuri a fiecărui părinte înscris la cursul victimei, purtând numele
-- clubului atacator — iar clubul victimă nici nu-l vede, deci nu-l poate retrage.
--
-- Se repară în trei locuri, fiindcă o singură verificare nu ajunge:
--   1. la citire, ca un anunț deja strecurat să nu mai fie livrat;
--   2. la scriere (INSERT și UPDATE), ca să nu mai poată fi creat;
--   3. în constrângere, scoțând `CAMP`: `camps` nu are `club_id`, deci pentru
--      tabere apartenența nici nu se poate exprima. Se pune la loc odată cu
--      coloana, când taberele devin ale clubului.

-- Rezolvă clubul care deține o țintă, ocolind RLS: politicile care citesc direct
-- din `courses`/`activities` sunt supuse politicilor ACELOR tabele, iar
-- `activities_select` nu are clauză de club, deci o activitate dezactivată ar
-- ieși invizibilă și verificarea ar pica din motivul greșit.
CREATE OR REPLACE FUNCTION public.audience_club_id(p_kind TEXT, p_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p_kind
        WHEN 'COURSE' THEN (SELECT c.club_id FROM public.courses c WHERE c.id = p_id)
        WHEN 'ACTIVITY' THEN (SELECT a.club_id FROM public.activities a WHERE a.id = p_id)
        ELSE NULL
    END
$$;

COMMENT ON FUNCTION public.audience_club_id(TEXT, UUID) IS
    'Clubul care detine cursul sau activitatea data. NULL daca entitatea nu exista, nu are club, sau tipul nu are apartenenta exprimabila (CAMP).';

GRANT EXECUTE ON FUNCTION public.audience_club_id(TEXT, UUID) TO authenticated;

-- `CAMP` iese din constrangere: nu are cum sa treaca verificarea de apartenenta.
ALTER TABLE public.club_announcements
    DROP CONSTRAINT IF EXISTS club_announcements_audience_kind_ck;
ALTER TABLE public.club_announcements
    ADD CONSTRAINT club_announcements_audience_kind_ck
    CHECK (audience_kind IN ('CLUB', 'COURSE', 'ACTIVITY'));

-- ===== Citirea =====
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
                    WHEN audience_kind = 'CLUB' THEN EXISTS (
                        SELECT 1
                        FROM public.enrollments e
                        JOIN public.children ch ON ch.id = e.child_id
                        WHERE ch.parent_id = (SELECT auth.uid())
                          AND e.status = 'ACTIVE'
                          AND public.audience_club_id(e.kind, e.entity_id)
                              = club_announcements.club_id
                    )
                    ELSE (
                        -- Apartenenta tintei, partea care lipsea.
                        public.audience_club_id(audience_kind, audience_id)
                            = club_announcements.club_id
                        AND EXISTS (
                            SELECT 1
                            FROM public.enrollments e
                            JOIN public.children ch ON ch.id = e.child_id
                            WHERE ch.parent_id = (SELECT auth.uid())
                              AND e.status = 'ACTIVE'
                              AND e.kind = club_announcements.audience_kind
                              AND e.entity_id = club_announcements.audience_id
                        )
                    )
                END
            )
        )
    );

-- ===== Scrierea =====
-- Fara verificarea aici, un anunt strain tot ar putea fi creat; l-ar opri doar
-- citirea, iar tabela ar aduna randuri pe care nimeni nu le poate sterge.
DROP POLICY IF EXISTS "club_announcements_insert" ON public.club_announcements;

CREATE POLICY "club_announcements_insert" ON public.club_announcements
    FOR INSERT TO authenticated
    WITH CHECK (
        (
            club_id IN (SELECT my_club_ids())
            OR (SELECT get_my_role()) = 'ADMIN'
        )
        AND (
            audience_kind = 'CLUB'
            OR public.audience_club_id(audience_kind, audience_id) = club_id
        )
    );

DROP POLICY IF EXISTS "club_announcements_update" ON public.club_announcements;

CREATE POLICY "club_announcements_update" ON public.club_announcements
    FOR UPDATE TO authenticated
    USING (
        club_id IN (SELECT my_club_ids())
        OR (SELECT get_my_role()) = 'ADMIN'
    )
    WITH CHECK (
        (
            club_id IN (SELECT my_club_ids())
            OR (SELECT get_my_role()) = 'ADMIN'
        )
        AND (
            audience_kind = 'CLUB'
            OR public.audience_club_id(audience_kind, audience_id) = club_id
        )
    );
