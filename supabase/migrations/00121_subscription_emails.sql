-- Subscription emails for coaches and clubs (feature #623).
--
-- The edge function send-subscription-emails runs hourly from pg_cron between
-- 06:17 and 18:17 UTC (08:17-21:17 in Romania in winter), so nothing lands at night. It
-- reads subscriptions and subscription_invoices, decides which emails are due
-- (trial ends in 14 and 3 days, payment failed, payment confirmed, subscription
-- ended) and sends them through Resend. subscription_email_log keeps one row per
-- email, keyed by dedupe_key, so a subscriber never receives the same email twice
-- and a failed send is retried at most three times.
--
-- Only service_role writes the log. ADMIN can read it through RLS for support
-- questions ("did they get the email?"); nobody else sees it.
--
-- The cron job needs the service key in Vault under `service_role_key`, exactly
-- like curatenie-media-expirata (00024). Whether anything is sent is decided by
-- the function's SUBSCRIPTION_EMAILS_MODE secret (off, test or live), not here.

CREATE TABLE public.subscription_email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN (
        'TRIAL_ENDS_14', 'TRIAL_ENDS_3', 'PAYMENT_FAILED', 'PAYMENT_CONFIRMED', 'SUBSCRIPTION_ENDED'
    )),
    dedupe_key TEXT NOT NULL UNIQUE CHECK (char_length(dedupe_key) BETWEEN 3 AND 200),
    recipient_email TEXT CHECK (char_length(recipient_email) <= 320),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
    provider_message_id TEXT CHECK (char_length(provider_message_id) <= 200),
    error TEXT CHECK (char_length(error) <= 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);
CREATE INDEX subscription_email_log_subscription_idx ON public.subscription_email_log (subscription_id);
CREATE INDEX subscription_email_log_retry_idx ON public.subscription_email_log (status) WHERE status IN ('PENDING', 'FAILED');

ALTER TABLE public.subscription_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_email_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscription_email_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_email_log TO service_role;

CREATE POLICY subscription_email_log_admin_read ON public.subscription_email_log
    FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) = 'ADMIN');

CREATE TRIGGER subscription_email_log_set_updated_at
    BEFORE UPDATE ON public.subscription_email_log
    FOR EACH ROW EXECUTE FUNCTION public.subscriptions_set_updated_at();

CREATE OR REPLACE FUNCTION public.call_send_subscription_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_key TEXT;
BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    IF v_key IS NULL THEN
        RAISE WARNING 'Subscription emails do not run: service_role_key is missing from Vault.';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := 'https://ehdzafadshbaaghzdzdo.supabase.co/functions/v1/send-subscription-emails',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
END;
$$;
REVOKE ALL ON FUNCTION public.call_send_subscription_emails() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('subscription-emails')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'subscription-emails');

SELECT cron.schedule(
    'subscription-emails',
    '17 6-18 * * *',
    $cron$SELECT public.call_send_subscription_emails();$cron$
);
