-- Tabăra capătă un proprietar, o desfășurare a prețului, antrenori și poze.
--
-- Decis cu proprietarul pe 2026-08-27:
--   * tabăra e a celui care o creează — un club sau un antrenor, niciodată ambii;
--   * categoriile de preț EXPLICĂ prețul, nu îl schimbă: părintele plătește
--     totalul, iar suma categoriilor trebuie să dea prețul taberei;
--   * antrenorii aleși apar pe pagină și văd cine s-a înscris, dar nu pot
--     modifica tabăra — aceea rămâne a celui care a făcut-o.
--
-- Nimic din lanțul de plată nu se atinge: `camps.price` rămâne singura sursă
-- pentru checkout, validare și Stripe. Categoriile stau lângă el, ca explicație.

-- ============================================================================
-- 1. Proprietarul și poza hero
-- ============================================================================

ALTER TABLE public.camps
    ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS hero_photo_storage_path TEXT;

COMMENT ON COLUMN public.camps.club_id IS
    'Clubul care a creat tabara. Exact una dintre club_id si coach_id e completata.';
COMMENT ON COLUMN public.camps.coach_id IS
    'Antrenorul care a creat tabara, pe cont propriu. Exact una dintre club_id si coach_id e completata.';

-- ATENTIE: comentariul de mai jos s-a dovedit FALS si a fost corectat in 00027.
-- `NOT VALID` scuteste doar validarea randurilor EXISTENTE la crearea
-- constrangerii; orice UPDATE ulterior reverifica randul, deci taberele fara
-- proprietar au ramas needitabile inclusiv de ADMIN. In 00027 constrangerea a
-- devenit `<= 1`, iar `camps_update` si-a primit un WITH CHECK adevarat.
-- `NOT VALID` dinadins: cele doua tabere existente nu au niciun proprietar, iar
-- a le atribui la nimereala ar fi o minciuna in date. Raman cum sunt — adica
-- editabile doar de ADMIN, exact comportamentul de azi — dar orice tabara noua
-- sau modificata trebuie sa aiba un stapan.
ALTER TABLE public.camps
    DROP CONSTRAINT IF EXISTS camps_owner_ck;
ALTER TABLE public.camps
    ADD CONSTRAINT camps_owner_ck
    CHECK (num_nonnulls(club_id, coach_id) = 1) NOT VALID;

CREATE INDEX IF NOT EXISTS camps_club_idx ON public.camps (club_id);
CREATE INDEX IF NOT EXISTS camps_coach_idx ON public.camps (coach_id);

/**
 * Poate utilizatorul curent sa administreze tabara data?
 *
 * SECURITY DEFINER fiindca e chemata si din politici de storage, unde o citire
 * directa din `camps` ar fi supusa politicilor lui `camps` — aici avem nevoie de
 * adevarul din tabela, nu de ce vede apelantul.
 */
CREATE OR REPLACE FUNCTION public.pot_administra_tabara(p_camp_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.camps c
        WHERE c.id = p_camp_id
          AND (
              c.club_id IN (SELECT my_club_ids())
              OR c.coach_id = (SELECT auth.uid())
          )
    ) OR (SELECT get_my_role()) = 'ADMIN'
$$;

GRANT EXECUTE ON FUNCTION public.pot_administra_tabara(UUID) TO authenticated;

-- Scrierea pe tabere: pana acum doar ADMIN. Acum si clubul sau antrenorul care o
-- creeaza. Poarta de rol la creare urmeaza migrarea 00014, care a facut acelasi
-- lucru pentru cursuri si activitati.
DROP POLICY IF EXISTS "camps_insert" ON public.camps;
CREATE POLICY "camps_insert" ON public.camps
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT get_my_role()) = 'ADMIN'
        OR (
            club_id IN (SELECT my_club_ids())
            AND coach_id IS NULL
            AND (SELECT get_my_role()) = 'CLUB'
        )
        OR (
            coach_id = (SELECT auth.uid())
            AND club_id IS NULL
            AND (SELECT get_my_role()) = 'COACH'
        )
    );

DROP POLICY IF EXISTS "camps_update" ON public.camps;
CREATE POLICY "camps_update" ON public.camps
    FOR UPDATE TO authenticated
    USING (public.pot_administra_tabara(id))
    WITH CHECK (public.pot_administra_tabara(id));

DROP POLICY IF EXISTS "camps_delete" ON public.camps;
CREATE POLICY "camps_delete" ON public.camps
    FOR DELETE TO authenticated
    USING (public.pot_administra_tabara(id));

-- ============================================================================
-- 2. Categoriile de preț
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.camp_price_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    -- In bani, ca `camps.price`, ca sa nu apara rotunjiri intre ele.
    amount BIGINT NOT NULL CHECK (amount >= 0),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.camp_price_items IS
    'Pe ce se duc banii dintr-o tabara: monitorizare, cazare, transport. Explica pretul, nu il schimba — plata ramane camps.price.';

CREATE INDEX IF NOT EXISTS camp_price_items_camp_idx
    ON public.camp_price_items (camp_id, display_order);

ALTER TABLE public.camp_price_items ENABLE ROW LEVEL SECURITY;

-- Citirea urmeaza tabara: taberele sunt publice, deci si desfasurarea pretului.
DROP POLICY IF EXISTS "camp_price_items_select" ON public.camp_price_items;
CREATE POLICY "camp_price_items_select" ON public.camp_price_items
    FOR SELECT TO anon, authenticated
    USING (camp_id IN (SELECT id FROM public.camps));

DROP POLICY IF EXISTS "camp_price_items_write" ON public.camp_price_items;
CREATE POLICY "camp_price_items_write" ON public.camp_price_items
    FOR ALL TO authenticated
    USING (public.pot_administra_tabara(camp_id))
    WITH CHECK (public.pot_administra_tabara(camp_id));

GRANT SELECT ON public.camp_price_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.camp_price_items TO authenticated;

-- ============================================================================
-- 3. Antrenorii care merg în tabără
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.camp_coaches (
    camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
    coach_profile_id UUID NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (camp_id, coach_profile_id)
);

COMMENT ON TABLE public.camp_coaches IS
    'Antrenorii care insotesc o tabara. Apar pe pagina publica si vad cine s-a inscris; nu pot modifica tabara.';

CREATE INDEX IF NOT EXISTS camp_coaches_coach_idx
    ON public.camp_coaches (coach_profile_id);

ALTER TABLE public.camp_coaches ENABLE ROW LEVEL SECURITY;

-- Parintele trebuie sa stie cu cine pleaca copilul, deci lista e publica.
DROP POLICY IF EXISTS "camp_coaches_select" ON public.camp_coaches;
CREATE POLICY "camp_coaches_select" ON public.camp_coaches
    FOR SELECT TO anon, authenticated
    USING (camp_id IN (SELECT id FROM public.camps));

DROP POLICY IF EXISTS "camp_coaches_write" ON public.camp_coaches;
CREATE POLICY "camp_coaches_write" ON public.camp_coaches
    FOR ALL TO authenticated
    USING (public.pot_administra_tabara(camp_id))
    WITH CHECK (public.pot_administra_tabara(camp_id));

GRANT SELECT ON public.camp_coaches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.camp_coaches TO authenticated;

-- ============================================================================
-- 4. Pozele
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.camp_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.camp_photos IS
    'Galeria unei tabere. Poza hero sta separat, in camps.hero_photo_storage_path. Inlocuieste camps.gallery_json, care a ramas nefolosit.';

CREATE INDEX IF NOT EXISTS camp_photos_camp_idx
    ON public.camp_photos (camp_id, display_order);

ALTER TABLE public.camp_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "camp_photos_select" ON public.camp_photos;
CREATE POLICY "camp_photos_select" ON public.camp_photos
    FOR SELECT TO anon, authenticated
    USING (camp_id IN (SELECT id FROM public.camps));

DROP POLICY IF EXISTS "camp_photos_write" ON public.camp_photos;
CREATE POLICY "camp_photos_write" ON public.camp_photos
    FOR ALL TO authenticated
    USING (public.pot_administra_tabara(camp_id))
    WITH CHECK (public.pot_administra_tabara(camp_id));

GRANT SELECT ON public.camp_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.camp_photos TO authenticated;

-- Bucket public, ca `course-photos` si `activity-photos`: paginile de tabere sunt
-- publice, deci pozele n-au nevoie de linkuri semnate. Spre deosebire de
-- `announcement-media`, care are poze cu copii la antrenament si e privat.
INSERT INTO storage.buckets (id, name, public)
VALUES ('camp-photos', 'camp-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Cale: camp-photos/{camp_id}/hero/{uuid}.{ext} si {camp_id}/gallery/{uuid}.{ext}
DROP POLICY IF EXISTS "camp_photos_public_read" ON storage.objects;
CREATE POLICY "camp_photos_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'camp-photos');

DROP POLICY IF EXISTS "camp_photos_owner_insert" ON storage.objects;
CREATE POLICY "camp_photos_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'camp-photos'
        AND public.pot_administra_tabara(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );

DROP POLICY IF EXISTS "camp_photos_owner_delete" ON storage.objects;
CREATE POLICY "camp_photos_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'camp-photos'
        AND public.pot_administra_tabara(
            public.safe_uuid((storage.foldername(name))[1])
        )
    );
