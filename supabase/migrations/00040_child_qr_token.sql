-- Copilul capătă o identitate scanabilă: un cod QR stabil, sub contul părintelui.
--
-- Cerut de proprietar și partener pe 2026-09-02 (funcț. #318), ca prim pas al
-- prezenței prin scanare (#319). Decis de proprietar: „cont de copil" = un
-- token sub părinte, FĂRĂ login propriu — copiii sunt minori; nu apare niciun
-- rol nou și RLS-ul lui `children` rămâne cum e (părintele, antrenorii și
-- cluburile cu copii înscriși îl pot citi).
--
-- Tokenul e aleatoriu, nu derivat din id: `gen_random_uuid()` folosește
-- generatorul criptografic al serverului (122 de biți), deci nu se poate ghici
-- din id-ul copilului sau din alt token. Conținutul codului QR e `MT1:<token>`,
-- versionat, fără URL.
--
-- Nimeni nu-și alege tokenul: la creare, valoarea trimisă de client se
-- înlocuiește cu una aleatorie; la editare, schimbarea lui e refuzată — singurul
-- drum e `regenereaza_codul_copilului`, care rulează ca proprietarul funcției,
-- nu ca `authenticated`, deci trece de poartă. Aceeași tehnică de rol real ca
-- porțile umane din Team Tracker.

ALTER TABLE public.children
    ADD COLUMN IF NOT EXISTS qr_token TEXT NOT NULL
        DEFAULT replace(gen_random_uuid()::text, '-', '');

ALTER TABLE public.children DROP CONSTRAINT IF EXISTS children_qr_token_key;
ALTER TABLE public.children ADD CONSTRAINT children_qr_token_key UNIQUE (qr_token);

COMMENT ON COLUMN public.children.qr_token IS
    'Identitatea scanabila a copilului (continutul QR e MT1:<token>). Aleatoriu, unic, regenerabil doar prin regenereaza_codul_copilului.';

CREATE OR REPLACE FUNCTION public.codul_copilului_nu_se_alege()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Clientul poate trimite orice; ce se salvează e mereu aleatoriu.
        IF current_user = 'authenticated' THEN
            NEW.qr_token := replace(gen_random_uuid()::text, '-', '');
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.qr_token IS DISTINCT FROM OLD.qr_token AND current_user = 'authenticated' THEN
        RAISE EXCEPTION 'Codul QR al copilului nu se scrie direct'
            USING ERRCODE = '42501',
                  HINT = 'Foloseste regenereaza_codul_copilului(child_id).';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_codul_copilului_nu_se_alege ON public.children;
CREATE TRIGGER trg_codul_copilului_nu_se_alege
    BEFORE INSERT OR UPDATE OF qr_token ON public.children
    FOR EACH ROW
    EXECUTE FUNCTION public.codul_copilului_nu_se_alege();

/**
 * Un cod nou pentru copil. Vechiul cod nu mai e recunoscut de nimeni din clipa
 * asta — de asta e al părintelui (sau al adminului), nu al antrenorului care
 * poate vedea copilul.
 */
CREATE OR REPLACE FUNCTION public.regenereaza_codul_copilului(p_child_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    nou TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.children c
        WHERE c.id = p_child_id
          AND (c.parent_id = (SELECT auth.uid()) OR (SELECT get_my_role()) = 'ADMIN')
    ) THEN
        RAISE EXCEPTION 'Doar parintele poate genera un cod nou pentru copil'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.children
    SET qr_token = replace(gen_random_uuid()::text, '-', '')
    WHERE id = p_child_id
    RETURNING qr_token INTO nou;

    RETURN nou;
END;
$$;

COMMENT ON FUNCTION public.regenereaza_codul_copilului(UUID) IS
    'Cod QR nou pentru copil; vechiul cod nu mai e recunoscut. Doar parintele sau adminul.';

REVOKE ALL ON FUNCTION public.regenereaza_codul_copilului(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenereaza_codul_copilului(UUID) TO authenticated;
