-- ============================================================
-- Rolul nu mai vine din metadatele trimise de client la înregistrare.
--
-- PROBLEMA, probată pe producție 2026-08-31 (nu deduse):
-- handle_new_user citea rolul din `raw_user_meta_data`, care e scris de
-- CLIENT. Un POST anonim către /auth/v1/signup, cu cheia anon publică și
-- `"data": {"role": "ADMIN"}`, a creat un cont cu profiles.role = 'ADMIN'.
-- Contul a fost șters imediat după probă. Confirmarea prin email e oprită
-- (config.toml), deci atacatorul nu trebuie să dețină nici măcar adresa.
-- Toate cele 19 conturi existente și-au primit rolul pe calea asta.
--
-- DE CE NU app_metadata, deși pe hârtie e canalul „de încredere":
-- GoTrue NU scrie `raw_app_meta_data` în același INSERT cu rândul; îl
-- completează printr-un UPDATE ulterior. Măsurat cu un trigger-sondă pe
-- auth.users: la INSERT, `NEW.raw_app_meta_data` era
-- {"provider":"email","providers":["email"]} — fără rol — deși pe rândul
-- persistat rolul apare. Un trigger care ar fi citit de acolo ar fi făcut
-- PARENT din fiecare antrenor și fiecare club.
--
-- SOLUȚIA: trigger-ul scrie întotdeauna cel mai mic privilegiu. Rolurile
-- legitime sunt ridicate explicit, imediat după createUser, de funcțiile
-- edge care rulează cu service_role: register-coach, register-club și
-- create-managed-coach. Ele sunt singurele care pot decide un privilegiu,
-- iar decizia lor e vizibilă în cod, nu ascunsă într-un câmp de metadate.
--
-- `name` și `phone` rămân din user_metadata: sunt date pe care utilizatorul
-- are dreptul să și le declare, nu privilegii.
--
-- Conturile existente nu sunt atinse: trigger-ul rulează doar la INSERT.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, phone, role, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'phone',
        -- Deliberat o constantă. Orice rol mai mare se acordă explicit,
        -- după creare, de o funcție edge cu service_role.
        'PARENT',
        now()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
