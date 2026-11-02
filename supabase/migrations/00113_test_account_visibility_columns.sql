-- Corectură la 00112 (bug #1312). `clubs` și `coach_profiles` au granturi de
-- SELECT pe coloane (00035), iar un câmp calculat PostgREST primește tot rândul,
-- deci anon a primit 42501 „permission denied for table clubs” la filtrul
-- `hidden_from_public=is.false`. Pentru aceste două tabele câmpul devine o
-- coloană reală, derivată din `profiles.is_test_account`:
--
-- * un trigger BEFORE INSERT/UPDATE o recalculează mereu din contul
--   proprietarului, deci clientul nu o poate schimba (tabelele au UPDATE la
--   nivel de tabelă);
-- * un trigger AFTER UPDATE pe `profiles` o actualizează când se schimbă
--   marcajul.
--
-- Cursurile, taberele, activitățile și concursurile rămân pe câmpul calculat
-- din 00112, care merge pentru că acolo SELECT e acordat pe tabelă.

DROP FUNCTION public.hidden_from_public(public.clubs);
DROP FUNCTION public.hidden_from_public(public.coach_profiles);

ALTER TABLE public.clubs
    ADD COLUMN hidden_from_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.coach_profiles
    ADD COLUMN hidden_from_public boolean NOT NULL DEFAULT false;

GRANT SELECT (hidden_from_public) ON public.clubs TO anon, authenticated;
GRANT SELECT (hidden_from_public) ON public.coach_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.derive_club_hidden_from_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.hidden_from_public := COALESCE(
        (SELECT p.is_test_account FROM public.profiles p WHERE p.id = NEW.owner_user_id),
        false
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.derive_coach_hidden_from_public()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.hidden_from_public := COALESCE(
        (SELECT p.is_test_account FROM public.profiles p WHERE p.id = NEW.user_id),
        false
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_test_account_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.clubs SET hidden_from_public = NEW.is_test_account
    WHERE owner_user_id = NEW.id AND hidden_from_public IS DISTINCT FROM NEW.is_test_account;
    UPDATE public.coach_profiles SET hidden_from_public = NEW.is_test_account
    WHERE user_id = NEW.id AND hidden_from_public IS DISTINCT FROM NEW.is_test_account;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.derive_club_hidden_from_public() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.derive_coach_hidden_from_public() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_test_account_visibility() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER derive_club_hidden_from_public
    BEFORE INSERT OR UPDATE ON public.clubs
    FOR EACH ROW EXECUTE FUNCTION public.derive_club_hidden_from_public();

CREATE TRIGGER derive_coach_hidden_from_public
    BEFORE INSERT OR UPDATE ON public.coach_profiles
    FOR EACH ROW EXECUTE FUNCTION public.derive_coach_hidden_from_public();

CREATE TRIGGER sync_test_account_visibility
    AFTER UPDATE OF is_test_account ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_test_account_visibility();

UPDATE public.clubs c SET hidden_from_public = true
FROM public.profiles p WHERE p.id = c.owner_user_id AND p.is_test_account;
UPDATE public.coach_profiles cp SET hidden_from_public = true
FROM public.profiles p WHERE p.id = cp.user_id AND p.is_test_account;
