-- Reparație la 00037, găsită la prima tabără creată din browser.
--
-- `tabara_pe_categorii_are_categorii` alegea id-ul taberei cu un CASE peste
-- `NEW.id` și `OLD.camp_id`. Expresia e una singură, iar PL/pgSQL o pregătește
-- întreagă, deci pe triggerul de pe `camps` cerea câmpul `camp_id` unui rând de
-- tabără, care nu îl are: „record "old" has no field "camp_id"" la commit-ul
-- oricărei tabere noi. Cu IF/ELSE fiecare ramură se pregătește doar când se
-- execută, pe tabela ei.
--
-- Nimic altceva nu se schimbă; triggerele rămân cele din 00037.

CREATE OR REPLACE FUNCTION public.tabara_pe_categorii_are_categorii()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    tabara UUID;
    mod TEXT;
BEGIN
    IF TG_TABLE_NAME = 'camps' THEN
        tabara := NEW.id;
    ELSE
        tabara := OLD.camp_id;
    END IF;

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
