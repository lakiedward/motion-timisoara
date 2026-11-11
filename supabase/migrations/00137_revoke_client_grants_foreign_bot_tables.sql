-- Bug #1382: tabelele boților de trading ai proprietarului (eToro S3 și widgetul
-- Revolut X) au păstrat drepturile implicite pentru anon și authenticated.
-- Boții, widgetul și pg_cron folosesc service_role sau postgres, care rămân
-- neatinse. Tabelele nu există în bazele locale, deci fiecare obiect e verificat.

DO $$
DECLARE
    obj text;
BEGIN
    FOREACH obj IN ARRAY ARRAY[
        'etoro_s3_control', 'etoro_s3_lease', 'etoro_s3_log',
        'etoro_s3_state', 'etoro_s3_status', 'revx_widget'
    ] LOOP
        IF to_regclass('public.' || obj) IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', obj);
        END IF;
    END LOOP;

    FOREACH obj IN ARRAY ARRAY[
        'etoro_s3_log_id_seq',
        'revx_log_id_seq', 'revx_ledger_id_seq',
        'revx_b_log_id_seq', 'revx_b_ledger_id_seq',
        'revx_c_log_id_seq', 'revx_c_ledger_id_seq'
    ] LOOP
        IF to_regclass('public.' || obj) IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon, authenticated', obj);
        END IF;
    END LOOP;
END
$$;
