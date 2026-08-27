-- Atașamentele pot aparține și unui anunț de club, iar filmările au termen.
--
-- `announcement_attachments` există din 00001, cu `type` IMAGE/VIDEO/URL și un FK
-- NOT NULL către `course_announcements`. Adică fizic nu putea ține nimic pentru
-- anunțurile clubului. Coloana veche devine opțională, apare una nouă către
-- `club_announcements`, iar o constrângere cere ca EXACT una să fie completată —
-- altfel un atașament ar putea rămâne legat de nimic sau de amândouă.
--
-- `expires_at` ține politica de retenție agreată cu proprietarul pe 2026-08-26:
-- filmările se șterg la 30 de zile, pozele rămân. Gol înseamnă „nu expiră”, deci
-- pozele nu au nevoie de nicio valoare specială.

ALTER TABLE public.announcement_attachments
    ALTER COLUMN announcement_id DROP NOT NULL;

ALTER TABLE public.announcement_attachments
    ADD COLUMN IF NOT EXISTS club_announcement_id UUID
        REFERENCES public.club_announcements(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.announcement_attachments.club_announcement_id IS
    'Anuntul de club caruia ii apartine atasamentul. Exact una dintre announcement_id si club_announcement_id e completata.';
COMMENT ON COLUMN public.announcement_attachments.expires_at IS
    'Cand se sterge fisierul. Gol = nu expira. Se pune doar pe filmari (30 de zile).';

ALTER TABLE public.announcement_attachments
    DROP CONSTRAINT IF EXISTS announcement_attachments_owner_ck;
ALTER TABLE public.announcement_attachments
    ADD CONSTRAINT announcement_attachments_owner_ck
    CHECK (num_nonnulls(announcement_id, club_announcement_id) = 1);

CREATE INDEX IF NOT EXISTS announcement_attachments_club_ann_idx
    ON public.announcement_attachments (club_announcement_id);
-- Functia programata de stergere cauta dupa termen, deci il indexam; randurile
-- fara termen (pozele) nu intra in index.
CREATE INDEX IF NOT EXISTS announcement_attachments_expires_idx
    ON public.announcement_attachments (expires_at)
    WHERE expires_at IS NOT NULL;

-- ============================================================================
-- Drepturile
--
-- Citirea urmareste anuntul: vezi atasamentul daca vezi anuntul de care atarna.
-- Subinterogarile de mai jos sunt ele insele filtrate de politicile tabelelor
-- respective, deci regula „doar parintii cursului” scrisa in 00021 se aplica si
-- aici, fara s-o rescriem a doua oara.
-- ============================================================================

DROP POLICY IF EXISTS "announcement_attachments_select" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_select" ON public.announcement_attachments
    FOR SELECT TO authenticated
    USING (
        announcement_id IN (SELECT id FROM public.course_announcements)
        OR club_announcement_id IN (SELECT id FROM public.club_announcements)
    );

-- Scrierea ramane a celui care detine anuntul: antrenorul cursului, clubul, ADMIN.
DROP POLICY IF EXISTS "announcement_attachments_insert" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_insert" ON public.announcement_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        announcement_id IN (
            SELECT ca.id FROM public.course_announcements ca
            JOIN public.courses c ON ca.course_id = c.id
            WHERE c.coach_id = (SELECT auth.uid())
        )
        OR club_announcement_id IN (
            SELECT id FROM public.club_announcements
            WHERE club_id IN (SELECT my_club_ids())
        )
        OR (SELECT get_my_role()) = 'ADMIN'
    );

DROP POLICY IF EXISTS "announcement_attachments_update" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_update" ON public.announcement_attachments
    FOR UPDATE TO authenticated
    USING (
        announcement_id IN (
            SELECT ca.id FROM public.course_announcements ca
            JOIN public.courses c ON ca.course_id = c.id
            WHERE c.coach_id = (SELECT auth.uid())
        )
        OR club_announcement_id IN (
            SELECT id FROM public.club_announcements
            WHERE club_id IN (SELECT my_club_ids())
        )
        OR (SELECT get_my_role()) = 'ADMIN'
    )
    WITH CHECK (
        announcement_id IN (
            SELECT ca.id FROM public.course_announcements ca
            JOIN public.courses c ON ca.course_id = c.id
            WHERE c.coach_id = (SELECT auth.uid())
        )
        OR club_announcement_id IN (
            SELECT id FROM public.club_announcements
            WHERE club_id IN (SELECT my_club_ids())
        )
        OR (SELECT get_my_role()) = 'ADMIN'
    );

DROP POLICY IF EXISTS "announcement_attachments_delete" ON public.announcement_attachments;
CREATE POLICY "announcement_attachments_delete" ON public.announcement_attachments
    FOR DELETE TO authenticated
    USING (
        announcement_id IN (
            SELECT ca.id FROM public.course_announcements ca
            JOIN public.courses c ON ca.course_id = c.id
            WHERE c.coach_id = (SELECT auth.uid())
        )
        OR club_announcement_id IN (
            SELECT id FROM public.club_announcements
            WHERE club_id IN (SELECT my_club_ids())
        )
        OR (SELECT get_my_role()) = 'ADMIN'
    );
