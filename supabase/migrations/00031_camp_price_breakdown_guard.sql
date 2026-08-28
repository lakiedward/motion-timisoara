-- Desfășurarea prețului nu se mai poate salva greșită.
--
-- Criteriul 2 al secțiunii #638 cerea două lucruri: suma categoriilor să dea
-- exact prețul taberei, ȘI cine o construiește să nu poată salva altfel. Prima
-- jumătate era făcută — pagina publică aduna și semnala nepotrivirea. A doua
-- lipsea, și a fost consemnată în auditul UI ca `needs_attention` pe #638.
--
-- Poarta stă aici, nu în formular. Un formular apără un drum; asta apără tabela.
--
-- Sunt DOUĂ găuri, nu una:
--   1. se salvează categorii care nu dau prețul;
--   2. se salvează categorii corecte, apoi se schimbă PREȚUL și desfășurarea se
--      rupe la loc, în tăcere.
-- Fără a doua, prima e o poartă cu ușa din spate deschisă.

-- ============================================================================
-- 1. Banii taberei se scriu împreună, sau deloc
-- ============================================================================
--
-- Prețul și categoriile se schimbă ÎN ACEEAȘI tranzacție, fiindcă invariantul e
-- între ele. Două cereri separate n-ar avea cum: oricare ar fi prima, între ele
-- există o clipă în care nu se potrivesc, iar triggerul de mai jos ar refuza-o.
CREATE OR REPLACE FUNCTION public.salveaza_banii_taberei(
    p_camp_id UUID,
    p_price BIGINT,
    p_categorii JSONB
)
RETURNS SETOF public.camp_price_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    suma BIGINT;
    fara_nume INT;
BEGIN
    IF NOT public.pot_administra_tabara(p_camp_id) THEN
        RAISE EXCEPTION 'Nu ai voie sa schimbi banii acestei tabere'
            USING ERRCODE = '42501';
    END IF;

    IF p_price < 0 THEN
        RAISE EXCEPTION 'Pretul nu poate fi negativ' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO fara_nume
    FROM jsonb_array_elements(p_categorii) c
    WHERE coalesce(btrim(c->>'name'), '') = '';

    IF fara_nume > 0 THEN
        RAISE EXCEPTION 'Fiecare categorie are nevoie de un nume' USING ERRCODE = 'P0001';
    END IF;

    SELECT coalesce(sum((c->>'amount')::BIGINT), 0) INTO suma
    FROM jsonb_array_elements(p_categorii) c;

    -- O desfășurare goală e îngăduită: tabăra are atunci doar preț, fără
    -- explicație. Ce nu e îngăduit e o explicație care nu se adună.
    IF jsonb_array_length(p_categorii) > 0 AND suma <> p_price THEN
        RAISE EXCEPTION
            'Suma categoriilor (%) nu da pretul taberei (%)', suma, p_price
            USING ERRCODE = 'P0001';
    END IF;

    -- Prețul întâi: triggerul de mai jos se uită la categoriile de pe disc, iar
    -- ele sunt încă cele vechi. Le ștergem imediat după, în aceeași tranzacție.
    DELETE FROM public.camp_price_items WHERE camp_id = p_camp_id;
    UPDATE public.camps SET price = p_price WHERE id = p_camp_id;

    RETURN QUERY
    INSERT INTO public.camp_price_items (camp_id, name, description, amount, display_order)
    SELECT p_camp_id,
           btrim(c->>'name'),
           nullif(btrim(coalesce(c->>'description', '')), ''),
           (c->>'amount')::BIGINT,
           (ordinalitate - 1)::INT
    FROM jsonb_array_elements(p_categorii) WITH ORDINALITY AS t(c, ordinalitate)
    RETURNING *;
END;
$$;

COMMENT ON FUNCTION public.salveaza_banii_taberei(UUID, BIGINT, JSONB) IS
    'Scrie pretul si desfasurarea lui impreuna. Refuza o desfasurare care nu da pretul.';

REVOKE ALL ON FUNCTION public.salveaza_banii_taberei(UUID, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salveaza_banii_taberei(UUID, BIGINT, JSONB) TO authenticated;

-- ============================================================================
-- 2. Ușa din spate: schimbarea prețului pe lângă funcție
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pretul_taberei_ramane_explicat()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    suma BIGINT;
BEGIN
    IF NEW.price IS NOT DISTINCT FROM OLD.price THEN
        RETURN NEW;
    END IF;

    SELECT sum(amount) INTO suma
    FROM public.camp_price_items WHERE camp_id = NEW.id;

    -- NULL = nicio categorie, deci nimic de contrazis.
    IF suma IS NOT NULL AND suma <> NEW.price THEN
        RAISE EXCEPTION
            'Pretul taberei (%) nu mai da suma categoriilor (%). Schimba-le impreuna.',
            NEW.price, suma
            USING ERRCODE = 'P0001',
                  HINT = 'Foloseste salveaza_banii_taberei(camp_id, pret, categorii).';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pretul_taberei_ramane_explicat ON public.camps;
CREATE TRIGGER trg_pretul_taberei_ramane_explicat
    BEFORE UPDATE OF price ON public.camps
    FOR EACH ROW
    EXECUTE FUNCTION public.pretul_taberei_ramane_explicat();

COMMENT ON FUNCTION public.pretul_taberei_ramane_explicat() IS
    'Opreste schimbarea pretului care ar lasa categoriile sa nu-l mai dea. Nu se aplica taberelor fara categorii.';
