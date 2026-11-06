-- Subscription emails: allow the "cancellation confirmed" kind (spec #609, #623).
--
-- send-subscription-emails now also sends CANCELLATION_CONFIRMED once, when a
-- coach or club cancels at the end of the paid period or of a trial with a
-- card, naming the last day of access. Only the kind CHECK of
-- subscription_email_log changes; no data, grant or policy changes.

ALTER TABLE public.subscription_email_log
    DROP CONSTRAINT subscription_email_log_kind_check;

ALTER TABLE public.subscription_email_log
    ADD CONSTRAINT subscription_email_log_kind_check CHECK (kind IN (
        'TRIAL_ENDS_14', 'TRIAL_ENDS_3', 'PAYMENT_FAILED', 'PAYMENT_CONFIRMED',
        'CANCELLATION_CONFIRMED', 'SUBSCRIPTION_ENDED'
    ));
