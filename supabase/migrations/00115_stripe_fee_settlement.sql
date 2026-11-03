-- Feature #636 and #640: the platform fee on a parent card payment is the
-- exact Stripe processing fee, and coaches and clubs see this month's online
-- payments on their dashboard.
--
-- payments.stripe_fee_amount holds the Stripe fee of the payment in bani, read
-- from the charge's balance transaction by the stripe-webhook function. NULL
-- means the payment is not settled yet and still carries the ceiling fee set
-- at checkout. payments.stripe_destination_account is the Express account the
-- payment was transferred to, so a payment counts for whoever received it.
--
-- get_card_payments_month() returns, for the calling COACH or CLUB owner, the
-- successful card payments transferred to their own Stripe account since the
-- first day of the current month in Romania: collected, fee withheld and net.
-- Writes stay with the service-role functions; payments RLS does not change.

ALTER TABLE public.payments
    ADD COLUMN stripe_fee_amount BIGINT
        CONSTRAINT payments_stripe_fee_amount_check CHECK (stripe_fee_amount IS NULL OR stripe_fee_amount >= 0),
    ADD COLUMN stripe_destination_account TEXT;

CREATE INDEX payments_destination_paid_idx ON public.payments (stripe_destination_account, paid_at)
    WHERE method = 'CARD' AND status = 'SUCCEEDED' AND stripe_destination_account IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_card_payments_month()
RETURNS TABLE (
    month_start DATE,
    collected BIGINT,
    stripe_fee BIGINT,
    net BIGINT,
    payment_count INTEGER,
    unsettled_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_role TEXT;
    v_account TEXT;
    v_month DATE := date_trunc('month', now() AT TIME ZONE 'Europe/Bucharest')::DATE;
BEGIN
    SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_uid;
    IF v_uid IS NULL OR v_role IS NULL OR v_role NOT IN ('COACH', 'CLUB') THEN
        RAISE EXCEPTION 'Nu ai acces la plățile online'
            USING ERRCODE = '42501';
    END IF;

    IF v_role = 'COACH' THEN
        SELECT cp.stripe_account_id INTO v_account
        FROM public.coach_profiles cp WHERE cp.user_id = v_uid;
    ELSE
        SELECT c.stripe_account_id INTO v_account
        FROM public.clubs c WHERE c.owner_user_id = v_uid;
    END IF;

    RETURN QUERY
    SELECT v_month,
        COALESCE(SUM(payment.amount), 0)::BIGINT,
        COALESCE(SUM(payment.platform_fee_amount), 0)::BIGINT,
        COALESCE(SUM(payment.coach_payout_amount), 0)::BIGINT,
        COUNT(payment.id)::INTEGER,
        COUNT(payment.id) FILTER (WHERE payment.stripe_fee_amount IS NULL)::INTEGER
    FROM public.payments payment
    WHERE v_account IS NOT NULL
      AND payment.stripe_destination_account = v_account
      AND payment.method = 'CARD'
      AND payment.status = 'SUCCEEDED'
      AND payment.paid_at >= (v_month::TIMESTAMP AT TIME ZONE 'Europe/Bucharest');
END;
$$;

REVOKE ALL ON FUNCTION public.get_card_payments_month() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_card_payments_month() TO authenticated;
