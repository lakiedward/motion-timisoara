-- Conturi de test ascunse din listele publice (bug #1312, decizia proprietarului
-- din 2026-11-02: „Șterge gunoiul, ascunde restul”).
--
-- Conturile de QA și demo trebuie să rămână (threadurile testează cu ele și
-- părinții de test au înscrieri la cursurile lor), dar nu trebuie să apară în
-- catalogul public. Migrarea adaugă:
--
-- * `profiles.is_test_account`: marcajul. Coloana nu primește niciun GRANT,
--   deci anon și authenticated nu o pot citi sau schimba (profiles folosește
--   granturi pe coloane din 00035). Se setează doar din SQL privilegiat.
-- * `public.hidden_from_public(<rând>)` pentru cluburi, antrenori, cursuri,
--   tabere, activități și concursuri: un câmp calculat PostgREST pe care
--   listele publice îl filtrează cu `hidden_from_public=is.false`. Un rând e
--   ascuns când contul antrenorului sau al proprietarului clubului e marcat.
--
-- RLS nu se schimbă: proprietarii, părinții înscriși și ADMIN văd în continuare
-- tot, iar paginile de detaliu prin link direct rămân accesibile. Până se
-- marchează vreun cont, nimic nu se ascunde.

ALTER TABLE public.profiles
    ADD COLUMN is_test_account boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_profile_test_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated')
       AND (
           (TG_OP = 'INSERT' AND NEW.is_test_account)
           OR (TG_OP = 'UPDATE' AND NEW.is_test_account IS DISTINCT FROM OLD.is_test_account)
       ) THEN
        RAISE EXCEPTION 'Marcajul de cont de test se schimbă doar din administrarea bazei.'
            USING ERRCODE = '42501', HINT = 'test_account_flag_protected';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_test_account() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guard_profile_test_account
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_test_account();

CREATE OR REPLACE FUNCTION private.is_test_owner(p_coach_id uuid, p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.is_test_account
          AND (
              p.id = p_coach_id
              OR p.id = (SELECT c.owner_user_id FROM public.clubs c WHERE c.id = p_club_id)
          )
    )
$$;

REVOKE ALL ON FUNCTION private.is_test_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hidden_from_public(public.clubs)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.is_test_owner($1.owner_user_id, NULL) $$;

CREATE OR REPLACE FUNCTION public.hidden_from_public(public.coach_profiles)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.is_test_owner($1.user_id, NULL) $$;

CREATE OR REPLACE FUNCTION public.hidden_from_public(public.courses)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.is_test_owner($1.coach_id, $1.club_id) $$;

CREATE OR REPLACE FUNCTION public.hidden_from_public(public.camps)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.is_test_owner($1.coach_id, $1.club_id) $$;

CREATE OR REPLACE FUNCTION public.hidden_from_public(public.activities)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.is_test_owner($1.coach_id, $1.club_id) $$;

CREATE OR REPLACE FUNCTION public.hidden_from_public(public.competitions)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$ SELECT private.is_test_owner($1.coach_id, $1.club_id) $$;

REVOKE ALL ON FUNCTION public.hidden_from_public(public.clubs) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hidden_from_public(public.coach_profiles) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hidden_from_public(public.courses) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hidden_from_public(public.camps) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hidden_from_public(public.activities) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hidden_from_public(public.competitions) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.hidden_from_public(public.clubs) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hidden_from_public(public.coach_profiles) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hidden_from_public(public.courses) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hidden_from_public(public.camps) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hidden_from_public(public.activities) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hidden_from_public(public.competitions) TO anon, authenticated;
