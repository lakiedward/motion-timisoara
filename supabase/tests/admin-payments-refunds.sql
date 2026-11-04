\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END;
$$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY, role TEXT NOT NULL, name TEXT, email TEXT, deleted_at TIMESTAMPTZ
);
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
CREATE OR REPLACE FUNCTION public.subscriptions_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TABLE public.clubs (id UUID PRIMARY KEY, owner_user_id UUID, name TEXT, email TEXT);
CREATE TABLE public.courses (id UUID PRIMARY KEY, name TEXT, coach_id UUID, club_id UUID);
CREATE TABLE public.activities (id UUID PRIMARY KEY, name TEXT, coach_id UUID, club_id UUID);
CREATE TABLE public.camps (id UUID PRIMARY KEY, title TEXT, coach_id UUID, club_id UUID);
CREATE TABLE public.competitions (id UUID PRIMARY KEY, title TEXT, coach_id UUID, club_id UUID);
CREATE TABLE public.children (id UUID PRIMARY KEY, parent_id UUID, name TEXT);
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY, kind TEXT, entity_id UUID, child_id UUID, adult_profile_id UUID, status TEXT
);
CREATE TABLE public.payments (
    id UUID PRIMARY KEY, enrollment_id UUID, method TEXT, amount BIGINT, currency TEXT DEFAULT 'RON',
    status TEXT, gateway_txn_id TEXT, billing_name TEXT, billing_email TEXT,
    stripe_fee_amount BIGINT, stripe_destination_account TEXT,
    created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), paid_at TIMESTAMPTZ
);
CREATE TABLE public.subscription_plans (code TEXT, subscriber_type TEXT, name TEXT);
CREATE TABLE public.subscriptions (id UUID PRIMARY KEY, club_id UUID, coach_user_id UUID);
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;
GRANT UPDATE ON public.payments, public.enrollments TO service_role;

\i /tmp/migrations/00119_admin_payments_refunds.sql
\i /tmp/migrations/00120_admin_payments_receiver.sql

INSERT INTO public.profiles (id, role, name, email) VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'ADMIN', 'Laki Admin', 'admin@example.test'),
    ('00000000-0000-0000-0000-0000000000c1', 'COACH', 'Antrenor', 'coach@example.test'),
    ('00000000-0000-0000-0000-0000000000dd', 'PARENT', 'Părinte', 'parent@example.test'),
    ('00000000-0000-0000-0000-0000000000d1', 'PARENT', 'Adult', 'adult@example.test');
INSERT INTO public.clubs VALUES
    ('00000000-0000-0000-0000-00000000cb01', '00000000-0000-0000-0000-0000000000c1', 'Club Delfinii', 'club@example.test');
INSERT INTO public.courses VALUES
    ('00000000-0000-0000-0000-00000000c001', 'Înot', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000cb01');
INSERT INTO public.activities VALUES
    ('00000000-0000-0000-0000-00000000ac01', 'Tură', '00000000-0000-0000-0000-0000000000c1', NULL);
INSERT INTO public.children VALUES
    ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000dd', 'Ana');
INSERT INTO public.enrollments VALUES
    ('00000000-0000-0000-0000-000000000e01', 'COURSE', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e1', NULL, 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000e02', 'ACTIVITY', '00000000-0000-0000-0000-00000000ac01', NULL, '00000000-0000-0000-0000-0000000000d1', 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000e03', 'COURSE', '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e1', NULL, 'ACTIVE');
INSERT INTO public.payments (id, enrollment_id, method, amount, status, gateway_txn_id, stripe_destination_account, paid_at) VALUES
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000e01', 'CARD', 40000, 'SUCCEEDED', 'cs_test_one', 'acct_club', '2026-11-03T10:00:00Z'),
    ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000e02', 'CASH', 7500, 'SUCCEEDED', NULL, NULL, '2026-11-03T11:00:00Z'),
    ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000e03', 'CARD', 20000, 'PENDING', NULL, NULL, NULL),
    ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000e03', 'CARD', 10000, 'SUCCEEDED', 'cs_test_one', 'acct_club', '2026-11-03T10:00:00Z');
UPDATE public.payments SET created_at = '2026-10-01T08:00:00Z' WHERE id = '00000000-0000-0000-0000-0000000000f3';
INSERT INTO public.subscription_plans VALUES ('CLUB', 'CLUB', 'Club');
INSERT INTO public.subscriptions VALUES ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000cb01', NULL);
INSERT INTO public.subscription_invoices (id, subscription_id, subscriber_type, plan_code, stripe_invoice_id,
    stripe_payment_intent_id, status, amount, paid_at, created_at) VALUES
    ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-00000000aa01', 'CLUB', 'CLUB', 'in_test1',
     'pi_invoice1', 'PAID', 34900, '2026-11-04T09:00:00Z', '2026-11-04T09:00:00Z');

CREATE FUNCTION pg_temp.expect_error(p_sql TEXT, p_state TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'Expected an error for: %', p_sql;
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Expected an error%' THEN RAISE; END IF;
    IF p_state IS NOT NULL AND SQLSTATE <> p_state THEN
        RAISE EXCEPTION 'Expected SQLSTATE % for %, got % (%)', p_state, p_sql, SQLSTATE, SQLERRM;
    END IF;
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE
    v_refund public.payment_refunds;
    v_payment public.payments;
    v_second public.payment_refunds;
BEGIN
    PERFORM pg_temp.expect_error($q$SELECT public.begin_payment_refund('PAYMENT',
        '00000000-0000-0000-0000-0000000000f1', 1000, 'Motiv valid', '00000000-0000-0000-0000-0000000000c1', false)$q$, '42501');
    PERFORM pg_temp.expect_error($q$SELECT public.begin_payment_refund('PAYMENT',
        '00000000-0000-0000-0000-0000000000f1', 1000, 'ok', '00000000-0000-0000-0000-0000000000a1', false)$q$, '22023');
    PERFORM pg_temp.expect_error($q$SELECT public.begin_payment_refund('PAYMENT',
        '00000000-0000-0000-0000-0000000000f1', 40001, 'Prea mult', '00000000-0000-0000-0000-0000000000a1', false)$q$, '22023');
    PERFORM pg_temp.expect_error($q$SELECT public.begin_payment_refund('PAYMENT',
        '00000000-0000-0000-0000-0000000000f3', 1000, 'Neplătită', '00000000-0000-0000-0000-0000000000a1', false)$q$, '22023');

    v_refund := public.begin_payment_refund('PAYMENT', '00000000-0000-0000-0000-0000000000f1', 30000,
        '  Ședințe ratate  ', '00000000-0000-0000-0000-0000000000a1', true);
    IF v_refund.status <> 'pending' OR NOT v_refund.reverse_transfer OR v_refund.cancel_enrollment
       OR v_refund.reason <> 'Ședințe ratate' OR v_refund.admin_name <> 'Laki Admin'
       OR v_refund.payer_snapshot <> 'Părinte' THEN
        RAISE EXCEPTION 'Card refund must start pending with a transfer reversal: %', row_to_json(v_refund);
    END IF;
    PERFORM pg_temp.expect_error($q$SELECT public.begin_payment_refund('PAYMENT',
        '00000000-0000-0000-0000-0000000000f1', 10001, 'Peste rest', '00000000-0000-0000-0000-0000000000a1', false)$q$, '22023');
    SELECT * INTO v_payment FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f1';
    IF v_payment.amount_refunded <> 0 OR v_payment.status <> 'SUCCEEDED' THEN
        RAISE EXCEPTION 'A pending refund must not change the payment yet';
    END IF;

    PERFORM public.settle_payment_refund(v_refund.id, 're_test1', 'succeeded', NULL);
    SELECT * INTO v_payment FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f1';
    IF v_payment.amount_refunded <> 30000 OR v_payment.status <> 'SUCCEEDED' THEN
        RAISE EXCEPTION 'Partial refund must keep SUCCEEDED and count 30000: %', row_to_json(v_payment);
    END IF;

    v_second := public.begin_payment_refund('PAYMENT', '00000000-0000-0000-0000-0000000000f1', 10000,
        'Restul', '00000000-0000-0000-0000-0000000000a1', true);
    IF NOT v_second.cancel_enrollment THEN
        RAISE EXCEPTION 'The refund that empties the payment may cancel the enrollment';
    END IF;
    PERFORM public.settle_payment_refund(v_second.id, 're_test2', 'failed', 'card_declined');
    SELECT * INTO v_payment FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f1';
    IF v_payment.amount_refunded <> 30000 OR (SELECT status FROM public.enrollments WHERE id = '00000000-0000-0000-0000-000000000e01') <> 'ACTIVE' THEN
        RAISE EXCEPTION 'A failed refund must not count or cancel';
    END IF;
    IF public.record_stripe_refund('re_test2', 'pi_x', 'cs_test_one', NULL, 10000, 'ron', 'succeeded', NULL) <> 'updated' THEN
        RAISE EXCEPTION 'Webhook must update the known refund';
    END IF;
    SELECT * INTO v_payment FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f1';
    IF v_payment.amount_refunded <> 40000 OR v_payment.status <> 'REFUNDED'
       OR (SELECT status FROM public.enrollments WHERE id = '00000000-0000-0000-0000-000000000e01') <> 'CANCELLED' THEN
        RAISE EXCEPTION 'Full refund must set REFUNDED and cancel the enrollment: %', row_to_json(v_payment);
    END IF;
    IF public.record_stripe_refund('re_test2', 'pi_x', 'cs_test_one', NULL, 10000, 'ron', 'succeeded', NULL) <> 'updated'
       OR (SELECT count(*) FROM public.payment_refunds WHERE payment_id = '00000000-0000-0000-0000-0000000000f1') <> 2 THEN
        RAISE EXCEPTION 'A repeated webhook must not duplicate the refund';
    END IF;

    IF public.record_stripe_refund('re_dash1', 'pi_x', 'cs_test_one', NULL, 4000, 'ron', 'succeeded', NULL) <> 'created' THEN
        RAISE EXCEPTION 'A dashboard refund must be recorded';
    END IF;
    IF (SELECT amount_refunded FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f4') <> 4000
       OR (SELECT origin FROM public.payment_refunds WHERE stripe_refund_id = 're_dash1') <> 'STRIPE' THEN
        RAISE EXCEPTION 'A dashboard refund must go to the checkout payment that still has money';
    END IF;
    IF public.record_stripe_refund('re_split', 'pi_x', 'cs_test_one', NULL, 7000, 'ron', 'pending', NULL) <> 'created' THEN
        RAISE EXCEPTION 'A new dashboard refund must be created';
    END IF;
    IF (SELECT count(*) FROM public.payment_refunds WHERE stripe_refund_id = 're_split') <> 1
       OR (SELECT amount FROM public.payment_refunds WHERE stripe_refund_id = 're_split') <> 6000 THEN
        RAISE EXCEPTION 'A dashboard refund above the rest must take only what is left';
    END IF;
    IF public.record_stripe_refund('re_split', 'pi_x', 'cs_test_one', NULL, 7000, 'ron', 'succeeded', NULL) <> 'updated' THEN
        RAISE EXCEPTION 'A repeated dashboard refund must be found';
    END IF;
    IF (SELECT count(*) FROM public.payment_refunds WHERE stripe_refund_id = 're_split') <> 1
       OR (SELECT status FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f4') <> 'REFUNDED' THEN
        RAISE EXCEPTION 'A repeated dashboard refund must update, not duplicate';
    END IF;
    IF public.record_stripe_refund('re_unknown', 'pi_none', NULL, NULL, 100, 'ron', 'succeeded', NULL) <> 'unknown' THEN
        RAISE EXCEPTION 'An unknown charge must be reported';
    END IF;

    PERFORM public.begin_payment_refund('PAYMENT', '00000000-0000-0000-0000-0000000000f2', 2500,
        'Prima parte cash', '00000000-0000-0000-0000-0000000000a1', false);
    v_refund := public.begin_payment_refund('PAYMENT', '00000000-0000-0000-0000-0000000000f2', 5000,
        'Bani dați înapoi cash', '00000000-0000-0000-0000-0000000000a1', true);
    IF v_refund.status <> 'succeeded' OR v_refund.method <> 'CASH' OR v_refund.reverse_transfer THEN
        RAISE EXCEPTION 'Cash refund is a succeeded record: %', row_to_json(v_refund);
    END IF;
    IF (SELECT status FROM public.payments WHERE id = '00000000-0000-0000-0000-0000000000f2') <> 'REFUNDED'
       OR (SELECT status FROM public.enrollments WHERE id = '00000000-0000-0000-0000-000000000e02') <> 'CANCELLED' THEN
        RAISE EXCEPTION 'Full cash refund must set REFUNDED and cancel';
    END IF;

    v_refund := public.begin_payment_refund('SUBSCRIPTION_INVOICE', '00000000-0000-0000-0000-00000000bb01', 34900,
        'Taxat din greșeală', '00000000-0000-0000-0000-0000000000a1', false);
    PERFORM public.record_stripe_refund('re_inv1', 'pi_invoice1', NULL, v_refund.id, 34900, 'ron', 'succeeded', NULL);
    IF (SELECT status FROM public.subscription_invoices WHERE id = '00000000-0000-0000-0000-00000000bb01') <> 'REFUNDED'
       OR (SELECT stripe_refund_id FROM public.payment_refunds WHERE id = v_refund.id) <> 're_inv1' THEN
        RAISE EXCEPTION 'Invoice refund must be matched by its row id and settle the invoice';
    END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
    v_row RECORD;
BEGIN
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
    IF (SELECT count(*) FROM public.get_admin_payments('2026-11-01', '2026-11-05')) <> 4 THEN
        RAISE EXCEPTION 'ADMIN must see the three paid enrollments and the invoice in range';
    END IF;
    IF (SELECT count(*) FROM public.get_admin_payments('2026-09-01', '2026-11-05')) <> 5 THEN
        RAISE EXCEPTION 'A pending payment must appear at its creation time';
    END IF;
    IF (SELECT count(*) FROM public.get_admin_payments('2026-11-04', '2026-11-05')) <> 1 THEN
        RAISE EXCEPTION 'The date range must filter by payment time';
    END IF;
    SELECT * INTO v_row FROM public.get_admin_payments('2026-11-01', '2026-11-05')
    WHERE id = '00000000-0000-0000-0000-0000000000f1';
    IF v_row.payer_name <> 'Părinte' OR v_row.payer_email <> 'parent@example.test' OR v_row.participant_name <> 'Ana'
       OR v_row.receiver_name <> 'Club Delfinii' OR v_row.offer_title <> 'Înot' OR v_row.amount_refunded <> 40000
       OR jsonb_array_length(v_row.refunds) <> 2 OR v_row.enrollment_status <> 'CANCELLED' OR NOT v_row.transferred THEN
        RAISE EXCEPTION 'Payment row is incomplete: %', row_to_json(v_row);
    END IF;
    SELECT * INTO v_row FROM public.get_admin_payments('2026-11-01', '2026-11-05')
    WHERE id = '00000000-0000-0000-0000-0000000000f2';
    IF v_row.payer_name <> 'Adult' OR NOT v_row.is_adult OR v_row.receiver_name <> 'Antrenor' OR v_row.transferred THEN
        RAISE EXCEPTION 'Adult cash row is incomplete: %', row_to_json(v_row);
    END IF;
    SELECT * INTO v_row FROM public.get_admin_payments('2026-09-01', '2026-11-05')
    WHERE id = '00000000-0000-0000-0000-0000000000f3';
    IF v_row.receiver_name <> 'Motion România' OR v_row.transferred THEN
        RAISE EXCEPTION 'A card payment without a Connect account goes to the platform: %', row_to_json(v_row);
    END IF;
    SELECT * INTO v_row FROM public.get_admin_payments('2026-11-01', '2026-11-05')
    WHERE source = 'SUBSCRIPTION_INVOICE';
    IF v_row.payer_name <> 'Club Delfinii' OR v_row.offer_title <> 'Club' OR v_row.status <> 'REFUNDED'
       OR v_row.kind <> 'CLUB' THEN
        RAISE EXCEPTION 'Invoice row is incomplete: %', row_to_json(v_row);
    END IF;
    IF (SELECT source FROM public.get_admin_payments('2026-11-01', '2026-11-05') LIMIT 1) <> 'SUBSCRIPTION_INVOICE' THEN
        RAISE EXCEPTION 'Newest payment must come first';
    END IF;
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.get_admin_payments('2025-01-01', '2026-11-05')$q$, '22023');
    IF (SELECT count(*) FROM public.payment_refunds) <> 7 OR (SELECT count(*) FROM public.subscription_invoices) <> 1 THEN
        RAISE EXCEPTION 'ADMIN must read refunds and invoices';
    END IF;
    PERFORM pg_temp.expect_error($q$INSERT INTO public.payment_refunds (method, amount, reason, status, origin)
        VALUES ('CASH', 1, 'abc', 'succeeded', 'ADMIN')$q$, '42501');
    PERFORM pg_temp.expect_error($q$SELECT public.begin_payment_refund('PAYMENT',
        '00000000-0000-0000-0000-0000000000f4', 100, 'Direct', '00000000-0000-0000-0000-0000000000a1', false)$q$, '42501');

    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.get_admin_payments('2026-11-01', '2026-11-05')$q$, '42501');
    IF (SELECT count(*) FROM public.payment_refunds) <> 0 OR (SELECT count(*) FROM public.subscription_invoices) <> 0 THEN
        RAISE EXCEPTION 'Non-admin must not read refunds or invoices';
    END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.get_admin_payments('2026-11-01', '2026-11-05')$q$);
    PERFORM pg_temp.expect_error($q$SELECT * FROM public.payment_refunds$q$);
END;
$$;
RESET ROLE;

ROLLBACK;
\echo 'admin-payments-refunds: OK'
