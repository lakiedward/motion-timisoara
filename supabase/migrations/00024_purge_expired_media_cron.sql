-- Curățenia zilnică a filmărilor expirate.
--
-- `expires_at` se scrie la încărcare — 30 de zile pentru filmări, gol pentru poze
-- — dar până acum nimic nu ducea politica la capăt, deci retenția era o intenție
-- scrisă în bază, nu un mecanism.
--
-- Ștergerea fișierelor NU se poate face din SQL: `storage.objects` are triggerul
-- `protect_objects_delete`, care refuză orice DELETE direct tocmai ca să nu rămână
-- obiecte orfane în magazie. De aceea treaba o face funcția edge
-- `purge-expired-media`, iar aici doar o chemăm zilnic.
--
-- CERE UN PAS MANUAL: cheia de service trebuie pusă în Vault, sub numele
-- `service_role_key`. Fără ea, funcția de mai jos nu cheamă nimic și scrie un
-- avertisment în log — deliberat, ca lipsa să se vadă, nu să treacă în tăcere.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.cheama_purge_expired_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_cheie TEXT;
    v_url TEXT := 'https://ehdzafadshbaaghzdzdo.supabase.co/functions/v1/purge-expired-media';
BEGIN
    SELECT decrypted_secret INTO v_cheie
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    IF v_cheie IS NULL THEN
        -- Nu aruncăm: o excepție ar umple logul cronului cu erori identice în
        -- fiecare noapte. Un avertisment spune limpede ce lipsește și ce se
        -- întâmplă cât timp lipsește.
        RAISE WARNING 'Curatenia media nu ruleaza: secretul service_role_key lipseste din Vault. Filmarile expirate raman in bucket.';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_cheie
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
END;
$$;

COMMENT ON FUNCTION public.cheama_purge_expired_media() IS
    'Cheama zilnic functia edge purge-expired-media, care sterge filmarile carora le-a trecut termenul. Cheia de service se citeste din Vault (service_role_key).';

-- Reprogramarea trebuie sa fie idempotenta: migrarea poate fi rulata din nou.
SELECT cron.unschedule('curatenie-media-expirata')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'curatenie-media-expirata');

-- 03:30 UTC, adica noaptea si in Romania, cand nimeni nu se uita la anunturi.
SELECT cron.schedule(
    'curatenie-media-expirata',
    '30 3 * * *',
    $cron$SELECT public.cheama_purge_expired_media();$cron$
);
