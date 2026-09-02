-- Tabăra poate avea preț diferit pe categorie de vârstă.
--
-- Cerut de proprietar și partener pe 2026-09-02 (funcț. #315). Decis în aceeași
-- zi: categoriile stau PE TABĂRĂ (fără șabloane de club sau de platformă);
-- refolosirea între tabere se face din formular, prin „copiază din altă tabără".
--
-- Ce se schimbă și ce NU:
--   * `camps.pricing_mode` — 'single' (azi: toți copiii plătesc `camps.price`)
--     sau 'by_age' (fiecare copil plătește suma categoriei lui de vârstă).
--   * `camp_age_prices` — intervalele de vârstă și suma fiecăruia, în bani.
--   * `camps.price` NU se atinge și rămâne prețul unic. Desfășurarea din
--     `camp_price_items` (00025/00031) explică în continuare DOAR prețul unic.
--   * Lanțul de plată (validate-enrollment, create-enrollment, pagina publică)
--     nu citește încă tabela — e pasul următor al #315. Până atunci modul
--     'by_age' e salvat, dar nu are efect asupra sumei plătite; proiectul nu e
--     deployat, deci niciun părinte nu plătește pe baza unui preț incomplet.
--
-- Vârsta se socotește la data de ÎNCEPUT a taberei, în ani împliniți — vezi
-- `varsta_la_data` și `pret_tabara_pentru_varsta`, pe care le va chema serverul.

-- ============================================================================
-- 1. Comutatorul pe tabără
-- ============================================================================

ALTER TABLE public.camps
    ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'single';

ALTER TABLE public.camps DROP CONSTRAINT IF EXISTS camps_pricing_mode_ck;
ALTER TABLE public.camps
    ADD CONSTRAINT camps_pricing_mode_ck
    CHECK (pricing_mode IN ('single', 'by_age'));

COMMENT ON COLUMN public.camps.pricing_mode IS
    'single = toti copiii platesc camps.price; by_age = fiecare copil plateste suma categoriei lui din camp_age_prices, socotita la data de inceput a taberei.';

-- ============================================================================
-- 2. Categoriile de vârstă
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.camp_age_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
    -- Ani împliniți, capete incluse: 6–8 cuprinde copiii de 6, 7 și 8 ani.
    age_from INTEGER NOT NULL CHECK (age_from BETWEEN 0 AND 25),
    age_to INTEGER NOT NULL CHECK (age_to BETWEEN 0 AND 25),
    -- În bani, ca `camps.price`.
    amount BIGINT NOT NULL CHECK (amount >= 0),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT camp_age_prices_interval_ck CHECK (age_from <= age_to)
);

COMMENT ON TABLE public.camp_age_prices IS
    'Pretul unei tabere pe categorie de varsta (ani impliniti la data de inceput, capete incluse). Se citeste doar cand camps.pricing_mode = by_age. Intervalele unei tabere nu se suprapun.';

CREATE INDEX IF NOT EXISTS camp_age_prices_camp_idx
    ON public.camp_age_prices (camp_id, display_order);

ALTER TABLE public.camp_age_prices ENABLE ROW LEVEL SECURITY;

-- Citirea urmează tabăra: taberele sunt publice, deci și prețurile lor.
DROP POLICY IF EXISTS "camp_age_prices_select" ON public.camp_age_prices;
CREATE POLICY "camp_age_prices_select" ON public.camp_age_prices
    FOR SELECT TO anon, authenticated
    USING (camp_id IN (SELECT id FROM public.camps));

DROP POLICY IF EXISTS "camp_age_prices_write" ON public.camp_age_prices;
CREATE POLICY "camp_age_prices_write" ON public.camp_age_prices
    FOR ALL TO authenticated
    USING (public.pot_administra_tabara(camp_id))
    WITH CHECK (public.pot_administra_tabara(camp_id));

GRANT SELECT ON public.camp_age_prices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.camp_age_prices TO authenticated;

-- ============================================================================
-- 3. Intervalele unei tabere nu se suprapun
-- ============================================================================
--
-- Poarta stă în tabelă, nu doar în funcția de salvare: politica de scriere lasă
-- proprietarul să insereze și direct, iar un copil de 8 ani nu poate avea două
-- prețuri. Trigger de constrângere AMÂNAT: un INSERT cu mai multe rânduri le
-- vede pe toate abia la commit, iar un BEFORE pe rând nu le-ar vedea pe cele
-- inserate de aceeași comandă.

CREATE OR REPLACE FUNCTION public.intervalele_de_varsta_nu_se_suprapun()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    vecin RECORD;
BEGIN
    SELECT b.age_from, b.age_to INTO vecin
    FROM public.camp_age_prices a
    JOIN public.camp_age_prices b
      ON b.camp_id = a.camp_id
     AND b.id <> a.id
     AND b.age_from <= a.age_to
     AND a.age_from <= b.age_to
    WHERE a.id = NEW.id
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Categoria %–% ani se suprapune cu %–% ani', NEW.age_from, NEW.age_to, vecin.age_from, vecin.age_to
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_intervalele_de_varsta_nu_se_suprapun ON public.camp_age_prices;
CREATE CONSTRAINT TRIGGER trg_intervalele_de_varsta_nu_se_suprapun
    AFTER INSERT OR UPDATE OF age_from, age_to, camp_id ON public.camp_age_prices
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.intervalele_de_varsta_nu_se_suprapun();

-- ============================================================================
-- 4. O tabără „pe categorii" are cel puțin o categorie
-- ============================================================================
--
-- Tot amânat: funcția de salvare pune întâi rândurile și apoi comutatorul, dar
-- un UPDATE direct pe `pricing_mode` fără niciun rând ar lăsa tabăra fără niciun
-- preț de dat vreunui copil. Se verifică la commit, de pe ambele părți: când
-- se schimbă comutatorul și când se șterg rânduri.

CREATE OR REPLACE FUNCTION public.tabara_pe_categorii_are_categorii()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    tabara UUID;
    mod TEXT;
BEGIN
    tabara := CASE WHEN TG_TABLE_NAME = 'camps' THEN NEW.id ELSE OLD.camp_id END;

    -- Tabăra ștearsă cu totul (cascadă) n-are ce verifica.
    SELECT pricing_mode INTO mod FROM public.camps WHERE id = tabara;
    IF NOT FOUND OR mod <> 'by_age' THEN
        RETURN NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.camp_age_prices WHERE camp_id = tabara) THEN
        RAISE EXCEPTION 'O tabara cu pret pe categorii are nevoie de cel putin o categorie de varsta'
            USING ERRCODE = 'P0001',
                  HINT = 'Foloseste salveaza_preturile_pe_varsta(camp_id, mod, categorii).';
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tabara_pe_categorii_are_categorii ON public.camps;
CREATE CONSTRAINT TRIGGER trg_tabara_pe_categorii_are_categorii
    AFTER INSERT OR UPDATE OF pricing_mode ON public.camps
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.tabara_pe_categorii_are_categorii();

DROP TRIGGER IF EXISTS trg_stergerea_lasa_categorii ON public.camp_age_prices;
CREATE CONSTRAINT TRIGGER trg_stergerea_lasa_categorii
    AFTER DELETE ON public.camp_age_prices
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION public.tabara_pe_categorii_are_categorii();

-- ============================================================================
-- 5. Comutatorul și categoriile se scriu împreună
-- ============================================================================
--
-- Aceeași formă ca `salveaza_banii_taberei` (00031): o singură tranzacție, cu
-- mesaje scrise pentru om, ca formularul să le poată arăta ca atare.

CREATE OR REPLACE FUNCTION public.salveaza_preturile_pe_varsta(
    p_camp_id UUID,
    p_pricing_mode TEXT,
    p_categorii JSONB
)
RETURNS SETOF public.camp_age_prices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    gresite INT;
    suprapuse RECORD;
BEGIN
    IF NOT public.pot_administra_tabara(p_camp_id) THEN
        RAISE EXCEPTION 'Nu ai voie sa schimbi preturile acestei tabere'
            USING ERRCODE = '42501';
    END IF;

    IF p_pricing_mode NOT IN ('single', 'by_age') THEN
        RAISE EXCEPTION 'Mod de pret necunoscut: %', p_pricing_mode USING ERRCODE = 'P0001';
    END IF;

    IF p_pricing_mode = 'by_age' AND jsonb_array_length(coalesce(p_categorii, '[]'::jsonb)) = 0 THEN
        RAISE EXCEPTION 'Pretul pe categorii are nevoie de cel putin o categorie de varsta'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO gresite
    FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) c
    WHERE (c->>'age_from')::INT IS NULL
       OR (c->>'age_to')::INT IS NULL
       OR (c->>'age_from')::INT > (c->>'age_to')::INT
       OR (c->>'age_from')::INT NOT BETWEEN 0 AND 25
       OR (c->>'age_to')::INT NOT BETWEEN 0 AND 25
       OR coalesce((c->>'amount')::BIGINT, -1) < 0;

    IF gresite > 0 THEN
        RAISE EXCEPTION 'Fiecare categorie are nevoie de un interval de varsta valid (0-25 ani) si de o suma'
            USING ERRCODE = 'P0001';
    END IF;

    -- Suprapunerile se refuză AICI, cu mesajul lor, înainte ca triggerul amânat
    -- să le prindă la commit cu un mesaj mai sec.
    SELECT a.f AS a_from, a.t AS a_to, b.f AS b_from, b.t AS b_to INTO suprapuse
    FROM (SELECT (c->>'age_from')::INT f, (c->>'age_to')::INT t, o FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) WITH ORDINALITY AS x(c, o)) a
    JOIN (SELECT (c->>'age_from')::INT f, (c->>'age_to')::INT t, o FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) WITH ORDINALITY AS y(c, o)) b
      ON a.o < b.o AND b.f <= a.t AND a.f <= b.t
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Categoria %–% ani se suprapune cu %–% ani', suprapuse.a_from, suprapuse.a_to, suprapuse.b_from, suprapuse.b_to
            USING ERRCODE = 'P0001';
    END IF;

    DELETE FROM public.camp_age_prices WHERE camp_id = p_camp_id;

    -- Rândurile înaintea comutatorului; oricum, ambele porți amânate se uită
    -- doar la commit.
    INSERT INTO public.camp_age_prices (camp_id, age_from, age_to, amount, display_order)
    SELECT p_camp_id,
           (c->>'age_from')::INT,
           (c->>'age_to')::INT,
           (c->>'amount')::BIGINT,
           (ordinalitate - 1)::INT
    FROM jsonb_array_elements(coalesce(p_categorii, '[]'::jsonb)) WITH ORDINALITY AS t(c, ordinalitate);

    UPDATE public.camps SET pricing_mode = p_pricing_mode WHERE id = p_camp_id;

    RETURN QUERY
    SELECT * FROM public.camp_age_prices WHERE camp_id = p_camp_id ORDER BY display_order;
END;
$$;

COMMENT ON FUNCTION public.salveaza_preturile_pe_varsta(UUID, TEXT, JSONB) IS
    'Scrie comutatorul de pret si categoriile de varsta impreuna. Refuza intervale suprapuse sau invalide si un mod by_age fara categorii.';

REVOKE ALL ON FUNCTION public.salveaza_preturile_pe_varsta(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salveaza_preturile_pe_varsta(UUID, TEXT, JSONB) TO authenticated;

-- ============================================================================
-- 6. Ce plătește un copil — pentru server, nu pentru client
-- ============================================================================
--
-- Clientul nu trimite niciodată prețul (decis 2026-09-02). Funcțiile edge
-- validate-enrollment și create-enrollment vor chema `pret_tabara_pentru_copil`
-- cu copilul înscris; pagina publică va chema `pret_tabara_pentru_varsta`.
-- NULL înseamnă „copilul nu intră în nicio categorie" și se refuză cu mesaj.

CREATE OR REPLACE FUNCTION public.varsta_la_data(p_birth_date DATE, p_la_data DATE)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    -- Ani împliniți: `age()` numără ani întregi, cum ar face un părinte.
    SELECT EXTRACT(YEAR FROM age(p_la_data, p_birth_date))::INT
$$;

CREATE OR REPLACE FUNCTION public.pret_tabara_pentru_varsta(p_camp_id UUID, p_varsta INTEGER)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN c.pricing_mode = 'single' THEN c.price
        ELSE (
            SELECT p.amount FROM public.camp_age_prices p
            WHERE p.camp_id = c.id AND p_varsta BETWEEN p.age_from AND p.age_to
            LIMIT 1
        )
    END
    FROM public.camps c
    WHERE c.id = p_camp_id
$$;

CREATE OR REPLACE FUNCTION public.pret_tabara_pentru_copil(p_camp_id UUID, p_child_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- SECURITY DEFINER fiindcă serverul o cheamă cu service_role, dar o poate
    -- chema și părintele: copilul e al lui, deci `children` e vizibil oricum.
    -- Nu întoarce nimic despre copil în afară de preț.
    SELECT public.pret_tabara_pentru_varsta(
        c.id,
        public.varsta_la_data(ch.birth_date, c.period_start)
    )
    FROM public.camps c
    JOIN public.children ch ON ch.id = p_child_id
    WHERE c.id = p_camp_id
$$;

GRANT EXECUTE ON FUNCTION public.varsta_la_data(DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pret_tabara_pentru_varsta(UUID, INTEGER) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.pret_tabara_pentru_copil(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pret_tabara_pentru_copil(UUID, UUID) TO authenticated;
