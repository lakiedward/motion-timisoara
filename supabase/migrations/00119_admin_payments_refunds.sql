-- Feature #648: admin payment history and refunds (spec
-- docs/superpowers/specs/2026-11-04-admin-payments-refunds-648.md).
--
-- payments gains the refunded total and the card brand and last four digits.
-- A partial refund keeps status SUCCEEDED; only a full refund sets REFUNDED,
-- so every reader that counts SUCCEEDED as paid keeps counting it.
-- subscription_invoices keeps one row per Stripe invoice of a coach or club
-- subscription, written by stripe-subscription-webhook. payment_refunds keeps
-- one row per refund of a payment or an invoice, with its reason, author and
-- Stripe outcome. Refund rows keep snapshots and use ON DELETE SET NULL so the
-- accounting history survives an account deletion.
--
-- Owner decision 2026-11-04 11:09Z (card cmsg_01N1bst9PBArftxkbGT7GHgDJD8H1xSHMjN6fA1ebxXneg):
-- the coach or club bears the Stripe fee of a refunded enrollment, so the
-- edge function reverses the transfer and keeps the application fee.
--
-- ADMIN reads the new tables and get_admin_payments(); every write goes
-- through the service-role functions below, called by admin-refund-payment and
-- the Stripe webhooks. No existing policy or grant changes.

ALTER TABLE public.payments
    ADD COLUMN amount_refunded BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN card_brand TEXT CHECK (card_brand IS NULL OR char_length(card_brand) BETWEEN 1 AND 40),
    ADD COLUMN card_last4 TEXT CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
    ADD CONSTRAINT payments_amount_refunded_check CHECK (amount_refunded >= 0 AND amount_refunded <= amount);

CREATE TABLE public.subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    subscriber_type TEXT NOT NULL CHECK (subscriber_type IN ('COACH', 'CLUB')),
    subscriber_name TEXT CHECK (char_length(subscriber_name) <= 200),
    plan_code TEXT CHECK (char_length(plan_code) <= 32),
    stripe_invoice_id TEXT NOT NULL UNIQUE CHECK (stripe_invoice_id ~ '^in_[A-Za-z0-9]+$'),
    stripe_payment_intent_id TEXT CHECK (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
    stripe_charge_id TEXT CHECK (stripe_charge_id ~ '^(ch|py)_[A-Za-z0-9]+$'),
    status TEXT NOT NULL CHECK (status IN ('PAID', 'FAILED', 'REFUNDED')),
    amount BIGINT NOT NULL CHECK (amount >= 0),
    amount_refunded BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'RON' CHECK (currency ~ '^[A-Z]{3}$'),
    billing_name TEXT CHECK (char_length(billing_name) <= 200),
    billing_email TEXT CHECK (char_length(billing_email) <= 320),
    card_brand TEXT CHECK (card_brand IS NULL OR char_length(card_brand) BETWEEN 1 AND 40),
    card_last4 TEXT CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
    hosted_invoice_url TEXT CHECK (char_length(hosted_invoice_url) <= 2000),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscription_invoices_refunded_check CHECK (amount_refunded >= 0 AND amount_refunded <= amount)
);
CREATE INDEX subscription_invoices_created_idx ON public.subscription_invoices (created_at DESC);
CREATE INDEX subscription_invoices_subscription_idx ON public.subscription_invoices (subscription_id);
CREATE INDEX subscription_invoices_intent_idx ON public.subscription_invoices (stripe_payment_intent_id);

CREATE TABLE public.payment_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    subscription_invoice_id UUID REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
    method TEXT NOT NULL CHECK (method IN ('CARD', 'CASH')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'RON' CHECK (currency ~ '^[A-Z]{3}$'),
    reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 500),
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'requires_action')),
    failure_reason TEXT CHECK (char_length(failure_reason) <= 500),
    origin TEXT NOT NULL CHECK (origin IN ('ADMIN', 'STRIPE')),
    stripe_refund_id TEXT CHECK (stripe_refund_id ~ '^(re|pyr)_[A-Za-z0-9]+$'),
    admin_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_name TEXT CHECK (char_length(admin_name) <= 200),
    payer_snapshot TEXT CHECK (char_length(payer_snapshot) <= 200),
    description_snapshot TEXT CHECK (char_length(description_snapshot) <= 300),
    reverse_transfer BOOLEAN NOT NULL DEFAULT false,
    cancel_enrollment BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_refunds_source_check CHECK (num_nonnulls(payment_id, subscription_invoice_id) <= 1),
    CONSTRAINT payment_refunds_cash_check CHECK (method = 'CARD' OR (stripe_refund_id IS NULL AND origin = 'ADMIN'))
);
CREATE INDEX payment_refunds_payment_idx ON public.payment_refunds (payment_id, created_at);
CREATE INDEX payment_refunds_invoice_idx ON public.payment_refunds (subscription_invoice_id, created_at);
CREATE INDEX payment_refunds_created_idx ON public.payment_refunds (created_at DESC);
CREATE UNIQUE INDEX payment_refunds_stripe_source_key ON public.payment_refunds (stripe_refund_id, payment_id, subscription_invoice_id) NULLS NOT DISTINCT
    WHERE stripe_refund_id IS NOT NULL;

CREATE TRIGGER subscription_invoices_set_updated_at
    BEFORE UPDATE ON public.subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION public.subscriptions_set_updated_at();
CREATE TRIGGER payment_refunds_set_updated_at
    BEFORE UPDATE ON public.payment_refunds
    FOR EACH ROW EXECUTE FUNCTION public.subscriptions_set_updated_at();

ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.subscription_invoices, public.payment_refunds FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.subscription_invoices, public.payment_refunds TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.subscription_invoices, public.payment_refunds TO service_role;

CREATE POLICY subscription_invoices_select_admin ON public.subscription_invoices
    FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) = 'ADMIN');
CREATE POLICY payment_refunds_select_admin ON public.payment_refunds
    FOR SELECT TO authenticated
    USING ((SELECT public.get_my_role()) = 'ADMIN');

CREATE OR REPLACE FUNCTION private.refresh_refunded_total(p_payment_id UUID, p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_total BIGINT;
BEGIN
    IF p_payment_id IS NOT NULL THEN
        SELECT COALESCE(sum(r.amount), 0) INTO v_total
        FROM public.payment_refunds r
        WHERE r.payment_id = p_payment_id AND r.status = 'succeeded';
        UPDATE public.payments p
        SET amount_refunded = LEAST(v_total, p.amount),
            status = CASE
                WHEN v_total >= p.amount AND p.status IN ('SUCCEEDED', 'REFUNDED') THEN 'REFUNDED'
                WHEN v_total < p.amount AND p.status = 'REFUNDED' THEN 'SUCCEEDED'
                ELSE p.status END,
            updated_at = now()
        WHERE p.id = p_payment_id;
    END IF;
    IF p_invoice_id IS NOT NULL THEN
        SELECT COALESCE(sum(r.amount), 0) INTO v_total
        FROM public.payment_refunds r
        WHERE r.subscription_invoice_id = p_invoice_id AND r.status = 'succeeded';
        UPDATE public.subscription_invoices i
        SET amount_refunded = LEAST(v_total, i.amount),
            status = CASE
                WHEN v_total >= i.amount AND i.amount > 0 AND i.status IN ('PAID', 'REFUNDED') THEN 'REFUNDED'
                WHEN v_total < i.amount AND i.status = 'REFUNDED' THEN 'PAID'
                ELSE i.status END
        WHERE i.id = p_invoice_id;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.refresh_refunded_total(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.refresh_refunded_total(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.begin_payment_refund(
    p_source TEXT,
    p_source_id UUID,
    p_amount BIGINT,
    p_reason TEXT,
    p_admin_user_id UUID,
    p_cancel_enrollment BOOLEAN
)
RETURNS public.payment_refunds
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_admin public.profiles%ROWTYPE;
    v_payment public.payments%ROWTYPE;
    v_invoice public.subscription_invoices%ROWTYPE;
    v_reserved BIGINT;
    v_refund public.payment_refunds;
    v_payer TEXT;
    v_description TEXT;
BEGIN
    SELECT * INTO v_admin FROM public.profiles WHERE id = p_admin_user_id;
    IF NOT FOUND OR v_admin.role <> 'ADMIN' OR v_admin.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Doar un administrator poate rambursa' USING ERRCODE = '42501';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Suma de rambursat trebuie să fie pozitivă' USING ERRCODE = '22023';
    END IF;
    IF p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 500 THEN
        RAISE EXCEPTION 'Motivul trebuie să aibă între 3 și 500 de caractere' USING ERRCODE = '22023';
    END IF;

    IF p_source = 'PAYMENT' THEN
        SELECT * INTO v_payment FROM public.payments WHERE id = p_source_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Plata nu există' USING ERRCODE = 'P0002';
        END IF;
        IF v_payment.status NOT IN ('SUCCEEDED', 'REFUNDED') THEN
            RAISE EXCEPTION 'Se pot rambursa doar plățile încasate' USING ERRCODE = '22023';
        END IF;
        SELECT COALESCE(sum(r.amount), 0) INTO v_reserved
        FROM public.payment_refunds r
        WHERE r.payment_id = v_payment.id AND r.status IN ('pending', 'succeeded', 'requires_action');
        IF v_reserved + p_amount > v_payment.amount THEN
            RAISE EXCEPTION 'Suma depășește cât se mai poate rambursa (% bani)', v_payment.amount - v_reserved
                USING ERRCODE = '22023';
        END IF;
        SELECT COALESCE(v_payment.billing_name, parent.name, adult.name),
               concat_ws(' · ', enrollment.kind, child.name)
        INTO v_payer, v_description
        FROM public.enrollments enrollment
        LEFT JOIN public.children child ON child.id = enrollment.child_id
        LEFT JOIN public.profiles parent ON parent.id = child.parent_id
        LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
        WHERE enrollment.id = v_payment.enrollment_id;
        INSERT INTO public.payment_refunds (
            payment_id, method, amount, currency, reason, status, origin, admin_user_id, admin_name,
            payer_snapshot, description_snapshot, reverse_transfer, cancel_enrollment
        ) VALUES (
            v_payment.id, v_payment.method, p_amount, v_payment.currency, btrim(p_reason),
            CASE WHEN v_payment.method = 'CASH' THEN 'succeeded' ELSE 'pending' END,
            'ADMIN', v_admin.id, v_admin.name, left(v_payer, 200), left(v_description, 300),
            v_payment.method = 'CARD' AND v_payment.stripe_destination_account IS NOT NULL,
            COALESCE(p_cancel_enrollment, false) AND v_reserved + p_amount = v_payment.amount
        ) RETURNING * INTO v_refund;
    ELSIF p_source = 'SUBSCRIPTION_INVOICE' THEN
        SELECT * INTO v_invoice FROM public.subscription_invoices WHERE id = p_source_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Factura nu există' USING ERRCODE = 'P0002';
        END IF;
        IF v_invoice.status NOT IN ('PAID', 'REFUNDED') OR v_invoice.stripe_payment_intent_id IS NULL THEN
            RAISE EXCEPTION 'Se pot rambursa doar facturile plătite cu cardul' USING ERRCODE = '22023';
        END IF;
        SELECT COALESCE(sum(r.amount), 0) INTO v_reserved
        FROM public.payment_refunds r
        WHERE r.subscription_invoice_id = v_invoice.id AND r.status IN ('pending', 'succeeded', 'requires_action');
        IF v_reserved + p_amount > v_invoice.amount THEN
            RAISE EXCEPTION 'Suma depășește cât se mai poate rambursa (% bani)', v_invoice.amount - v_reserved
                USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.payment_refunds (
            subscription_invoice_id, method, amount, currency, reason, status, origin, admin_user_id,
            admin_name, payer_snapshot, description_snapshot
        ) VALUES (
            v_invoice.id, 'CARD', p_amount, v_invoice.currency, btrim(p_reason), 'pending', 'ADMIN',
            v_admin.id, v_admin.name, left(COALESCE(v_invoice.subscriber_name, v_invoice.billing_name), 200),
            left(concat_ws(' · ', 'Abonament', v_invoice.plan_code), 300)
        ) RETURNING * INTO v_refund;
    ELSE
        RAISE EXCEPTION 'Sursa rambursării nu este validă' USING ERRCODE = '22023';
    END IF;

    IF v_refund.status = 'succeeded' THEN
        PERFORM private.refresh_refunded_total(v_refund.payment_id, NULL);
        IF v_refund.cancel_enrollment THEN
            UPDATE public.enrollments SET status = 'CANCELLED' WHERE id = v_payment.enrollment_id;
        END IF;
    END IF;
    RETURN v_refund;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_payment_refund(TEXT, UUID, BIGINT, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_payment_refund(TEXT, UUID, BIGINT, TEXT, UUID, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_payment_refund(
    p_refund_id UUID,
    p_stripe_refund_id TEXT,
    p_status TEXT,
    p_failure_reason TEXT
)
RETURNS public.payment_refunds
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_refund public.payment_refunds;
    v_was TEXT;
BEGIN
    SELECT status INTO v_was FROM public.payment_refunds WHERE id = p_refund_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rambursarea nu există' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.payment_refunds
    SET stripe_refund_id = COALESCE(p_stripe_refund_id, stripe_refund_id),
        status = p_status,
        failure_reason = left(p_failure_reason, 500)
    WHERE id = p_refund_id
    RETURNING * INTO v_refund;
    PERFORM private.refresh_refunded_total(v_refund.payment_id, v_refund.subscription_invoice_id);
    IF v_refund.status = 'succeeded' AND v_was <> 'succeeded' AND v_refund.cancel_enrollment
       AND v_refund.payment_id IS NOT NULL THEN
        UPDATE public.enrollments e SET status = 'CANCELLED'
        FROM public.payments p
        WHERE p.id = v_refund.payment_id AND e.id = p.enrollment_id;
    END IF;
    RETURN v_refund;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_payment_refund(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment_refund(UUID, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.record_stripe_refund(
    p_stripe_refund_id TEXT,
    p_payment_intent_id TEXT,
    p_checkout_session_id TEXT,
    p_refund_row_id UUID,
    p_amount BIGINT,
    p_currency TEXT,
    p_status TEXT,
    p_failure_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_existing UUID;
    v_payment UUID;
    v_invoice UUID;
    v_left BIGINT := p_amount;
    v_take BIGINT;
    v_row RECORD;
BEGIN
    FOR v_existing IN
        SELECT r.id FROM public.payment_refunds r
        WHERE r.stripe_refund_id = p_stripe_refund_id
           OR (p_refund_row_id IS NOT NULL AND r.id = p_refund_row_id)
        ORDER BY r.created_at, r.id
    LOOP
        PERFORM public.settle_payment_refund(v_existing, p_stripe_refund_id, p_status, p_failure_reason);
        v_payment := COALESCE(v_payment, v_existing);
    END LOOP;
    IF v_payment IS NOT NULL THEN
        RETURN 'updated';
    END IF;

    SELECT id INTO v_invoice FROM public.subscription_invoices
    WHERE stripe_payment_intent_id = p_payment_intent_id FOR UPDATE;
    IF v_invoice IS NOT NULL THEN
        INSERT INTO public.payment_refunds (subscription_invoice_id, method, amount, currency, reason, status,
            origin, stripe_refund_id, failure_reason)
        VALUES (v_invoice, 'CARD', p_amount, upper(p_currency), 'Rambursare făcută direct din Stripe',
            p_status, 'STRIPE', p_stripe_refund_id, left(p_failure_reason, 500));
        PERFORM private.refresh_refunded_total(NULL, v_invoice);
        RETURN 'created';
    END IF;

    FOR v_row IN
        SELECT p.id, p.amount - p.amount_refunded AS refundable, p.currency
        FROM public.payments p
        WHERE p.method = 'CARD'
          AND p.gateway_txn_id IN (p_payment_intent_id, p_checkout_session_id)
        ORDER BY p.created_at, p.id
        FOR UPDATE
    LOOP
        EXIT WHEN v_left <= 0;
        v_take := LEAST(v_left, v_row.refundable);
        CONTINUE WHEN v_take <= 0;
        v_payment := v_row.id;
        INSERT INTO public.payment_refunds (payment_id, method, amount, currency, reason, status, origin,
            stripe_refund_id, failure_reason)
        VALUES (v_row.id, 'CARD', v_take, v_row.currency, 'Rambursare făcută direct din Stripe', p_status,
            'STRIPE', p_stripe_refund_id,
            left(p_failure_reason, 500));
        PERFORM private.refresh_refunded_total(v_row.id, NULL);
        v_left := v_left - v_take;
    END LOOP;
    IF v_payment IS NULL THEN
        RETURN 'unknown';
    END IF;
    RETURN 'created';
END;
$$;
REVOKE ALL ON FUNCTION public.record_stripe_refund(TEXT, TEXT, TEXT, UUID, BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_stripe_refund(TEXT, TEXT, TEXT, UUID, BIGINT, TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.get_admin_payments(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (
    source TEXT,
    id UUID,
    kind TEXT,
    offer_title TEXT,
    participant_name TEXT,
    is_adult BOOLEAN,
    payer_name TEXT,
    payer_email TEXT,
    receiver_name TEXT,
    method TEXT,
    card_brand TEXT,
    card_last4 TEXT,
    amount BIGINT,
    amount_refunded BIGINT,
    stripe_fee_amount BIGINT,
    currency TEXT,
    status TEXT,
    gateway_ref TEXT,
    created_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    enrollment_status TEXT,
    refunds JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT auth.uid()) IS NULL OR (SELECT public.get_my_role()) IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'Doar administratorii văd istoricul plăților' USING ERRCODE = '42501';
    END IF;
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > INTERVAL '1 year 1 day' THEN
        RAISE EXCEPTION 'Intervalul trebuie să aibă cel mult un an' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
    WITH offers AS (
        SELECT 'COURSE'::TEXT AS kind, c.id, c.name AS title, c.coach_id, c.club_id FROM public.courses c
        UNION ALL
        SELECT 'ACTIVITY', a.id, a.name, a.coach_id, a.club_id FROM public.activities a
        UNION ALL
        SELECT 'CAMP', t.id, t.title, t.coach_id, t.club_id FROM public.camps t
        UNION ALL
        SELECT 'COMPETITION', m.id, m.title, m.coach_id, m.club_id FROM public.competitions m
    ),
    refund_lists AS (
        SELECT r.payment_id, r.subscription_invoice_id,
            jsonb_agg(jsonb_build_object(
                'id', r.id, 'amount', r.amount, 'status', r.status, 'reason', r.reason,
                'origin', r.origin, 'admin_name', r.admin_name, 'failure_reason', r.failure_reason,
                'cancel_enrollment', r.cancel_enrollment, 'created_at', r.created_at
            ) ORDER BY r.created_at) AS items
        FROM public.payment_refunds r
        GROUP BY r.payment_id, r.subscription_invoice_id
    )
    , history AS (
    SELECT 'PAYMENT'::TEXT AS source, payment.id, enrollment.kind, offer.title,
        COALESCE(child.name, adult.name), enrollment.child_id IS NULL,
        COALESCE(NULLIF(payment.billing_name, ''), parent.name, adult.name),
        COALESCE(NULLIF(payment.billing_email, ''), parent.email, adult.email),
        COALESCE(club.name, coach.name, 'Motion România'),
        payment.method, payment.card_brand, payment.card_last4,
        payment.amount, payment.amount_refunded, payment.stripe_fee_amount, payment.currency,
        payment.status, payment.gateway_txn_id, payment.created_at, payment.paid_at,
        enrollment.status, COALESCE(refund.items, '[]'::JSONB)
    FROM public.payments payment
    JOIN public.enrollments enrollment ON enrollment.id = payment.enrollment_id
    LEFT JOIN offers offer ON offer.kind = enrollment.kind AND offer.id = enrollment.entity_id
    LEFT JOIN public.clubs club ON club.id = offer.club_id
    LEFT JOIN public.profiles coach ON coach.id = offer.coach_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles parent ON parent.id = child.parent_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    LEFT JOIN refund_lists refund ON refund.payment_id = payment.id
    WHERE COALESCE(payment.paid_at, payment.created_at) >= p_from
      AND COALESCE(payment.paid_at, payment.created_at) < p_to
    UNION ALL
    SELECT 'SUBSCRIPTION_INVOICE'::TEXT, invoice.id, invoice.subscriber_type,
        COALESCE(plan.name, invoice.plan_code, 'Abonament'), NULL::TEXT, false,
        COALESCE(sub_club.name, sub_coach.name, invoice.subscriber_name, invoice.billing_name),
        COALESCE(invoice.billing_email, sub_club.email, sub_coach.email),
        'Motion România'::TEXT, 'CARD'::TEXT, invoice.card_brand, invoice.card_last4,
        invoice.amount, invoice.amount_refunded, NULL::BIGINT, invoice.currency,
        CASE invoice.status WHEN 'PAID' THEN 'SUCCEEDED' ELSE invoice.status END,
        invoice.stripe_invoice_id, invoice.created_at, invoice.paid_at, NULL::TEXT,
        COALESCE(refund.items, '[]'::JSONB)
    FROM public.subscription_invoices invoice
    LEFT JOIN public.subscriptions sub ON sub.id = invoice.subscription_id
    LEFT JOIN public.clubs sub_club ON sub_club.id = sub.club_id
    LEFT JOIN public.profiles sub_coach ON sub_coach.id = sub.coach_user_id
    LEFT JOIN public.subscription_plans plan
        ON plan.code = invoice.plan_code AND plan.subscriber_type = invoice.subscriber_type
    LEFT JOIN refund_lists refund ON refund.subscription_invoice_id = invoice.id
    WHERE COALESCE(invoice.paid_at, invoice.created_at) >= p_from
      AND COALESCE(invoice.paid_at, invoice.created_at) < p_to
    )
    SELECT h.* FROM history h
    ORDER BY COALESCE(h.paid_at, h.created_at) DESC, h.id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_admin_payments(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_payments(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
