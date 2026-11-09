-- Un cont dezactivat sau șters nu mai poate folosi API-ul de date din sesiunea
-- pe care o avea deja deschisă.
--
-- To-Do TT #333, continuarea lui #326. Dezactivarea din admin blochează contul în
-- Supabase Auth (funcția admin-set-user-enabled), deci reîmprospătarea tokenului
-- și `/auth/v1/user` sunt refuzate imediat. Tokenul de acces deja emis rămâne însă
-- valabil până expiră (`jwt_exp` = 3600 s), iar PostgREST verifică doar
-- semnătura lui. Până atunci, ramurile care compară direct `auth.uid()` lăsau
-- contul dezactivat să scrie: anunțuri la cursurile proprii (cu push către
-- părinți), cursuri, activități, ședințe, poze, locații, fișa de antrenor,
-- clubul propriu, copiii și recenziile părintelui.
--
-- Funcția rulează înaintea fiecărei cereri PostgREST (`db_pre_request`) și
-- oprește cu HTTP 403 orice cerere a unui cont cu `enabled = false` sau
-- `deleted_at` setat. Codul răspunsului e `account_disabled` sau
-- `account_deleted`; aplicația îl recunoaște și închide sesiunea cu mesaj.
-- Cererile anonime, cele cu cheia service_role și conturile fără profil trec
-- neschimbate (o singură căutare după cheia primară).
--
-- Nu acoperă Storage și Realtime (limita `db_pre_request`): acolo rămân doar
-- fișierele proprii (poza de antrenor, pozele copiilor, media anunțurilor), cel
-- mult până expiră tokenul. Ștergerea contului de părinte are nevoie de Storage
-- după `delete_my_account()`, deci acele politici rămân cum sunt.
--
-- Migrația se oprește dacă PostgREST are deja o funcție `db_pre_request`, ca să
-- n-o calce. Revenire: `ALTER ROLE authenticator RESET pgrst.db_pre_request;`
-- urmat de `NOTIFY pgrst, 'reload config';`.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_db_role_setting s
        JOIN pg_roles r ON r.oid = s.setrole
        CROSS JOIN LATERAL unnest(s.setconfig) AS c(setting)
        WHERE r.rolname = 'authenticator'
          AND c.setting LIKE 'pgrst.db_pre_request=%'
    ) THEN
        RAISE EXCEPTION 'authenticator are deja pgrst.db_pre_request; migrația 00134 nu o înlocuiește.';
    END IF;
END
$$;

CREATE FUNCTION public.reject_inactive_account()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_enabled BOOLEAN;
    v_deleted_at TIMESTAMPTZ;
BEGIN
    SELECT p.enabled, p.deleted_at INTO v_enabled, v_deleted_at
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid());

    IF NOT FOUND OR (v_enabled AND v_deleted_at IS NULL) THEN
        RETURN;
    END IF;

    RAISE SQLSTATE 'PGRST' USING
        MESSAGE = json_build_object(
            'code', CASE WHEN v_deleted_at IS NULL THEN 'account_disabled' ELSE 'account_deleted' END,
            'message', CASE WHEN v_deleted_at IS NULL
                THEN 'Contul a fost dezactivat.'
                ELSE 'Contul a fost șters.' END,
            'details', NULL,
            'hint', NULL)::TEXT,
        DETAIL = json_build_object('status', 403, 'headers', json_build_object())::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_inactive_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_inactive_account() TO anon, authenticated, service_role;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.reject_inactive_account';

NOTIFY pgrst, 'reload config';
