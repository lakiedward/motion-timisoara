-- ============================================================
-- Datele bancare și fiscale nu mai sunt lizibile de orice cont autentificat.
--
-- PROBLEMA, măsurată pe producție 2026-08-31: `clubs_select` și
-- `coach_profiles_select` sunt `USING (true)` pentru anon ȘI authenticated.
-- Anonimul e oprit doar de granturile pe coloane din 00012; pentru
-- `authenticated` nu exista niciun grant restrictiv — avea SELECT la nivel
-- de TABEL. Adică orice cont, inclusiv un părinte fără nicio înscriere,
-- putea citi IBAN-ul, CUI-ul, adresa firmei și id-ul de cont Stripe ale
-- oricărui club și ale oricărui antrenor.
--
-- Coloanele sunt goale azi (nimeni nu și-a completat datele de firmă), deci
-- expunerea e viitoare, nu trecută — dar se deschide singură în ziua în care
-- primul club își completează profilul de facturare.
--
-- DE CE PE COLOANE, NU PE RÂNDURI: RLS filtrează rânduri, nu coloane. Numele
-- și datele publice ale cluburilor și antrenorilor se citesc din 13 locuri
-- din aplicație, inclusiv de pe paginile publice. O politică de rând strânsă
-- ar fi golit directorul de antrenori și cardurile de curs. Granturile pe
-- coloane fac exact separarea cerută: public rămâne public, privatul dispare
-- pentru toată lumea în afară de proprietar.
--
-- Statusurile Stripe (stripe_onboarding_complete / charges / payouts) rămân
-- lizibile: sunt booleeni operaționali, nu date sensibile, iar
-- `getMyCoachStripeStatus` îi citește direct.
--
-- Proprietarul își recuperează rândul întreg prin `my_club()`, o funcție
-- SECURITY DEFINER legată de auth.uid(). Este singura cale prin care datele
-- de facturare mai ies din bază către un client.
-- ============================================================

-- --- clubs -------------------------------------------------------------
-- Revocarea pe coloane nu are efect cât timp rolul are grant pe tabel, deci
-- întâi cade grantul de tabel, apoi se acordă explicit ce e permis.
REVOKE SELECT ON public.clubs FROM authenticated;
GRANT SELECT (
    id, owner_user_id, name, description,
    logo_storage_path, hero_photo_storage_path, website,
    phone, email, public_email_consent, address, city, created_at,
    stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled
) ON public.clubs TO authenticated;
-- Rămân în afara grantului: bank_account, bank_name, company_name,
-- company_cui, company_reg_number, company_address, stripe_account_id.

-- --- coach_profiles ----------------------------------------------------
REVOKE SELECT ON public.coach_profiles FROM authenticated;
GRANT SELECT (
    id, user_id, bio, avatar_url, photo_storage_path,
    stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled
) ON public.coach_profiles TO authenticated;
-- Rămân în afara grantului: bank_account, bank_name, company_name,
-- company_cui, company_reg_number, company_address, has_company,
-- stripe_account_id.

-- --- calea proprietarului ----------------------------------------------
-- `getMyClub` făcea `select('*')`, care eșuează acum: SELECT * cere grant pe
-- toate coloanele. Funcția întoarce rândul întreg, dar numai al celui care
-- întreabă.
CREATE OR REPLACE FUNCTION public.my_club()
RETURNS SETOF public.clubs
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT * FROM public.clubs WHERE owner_user_id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.my_club() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_club() TO authenticated;

NOTIFY pgrst, 'reload schema';
