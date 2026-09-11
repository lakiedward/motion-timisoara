ALTER TABLE public.courses ADD COLUMN eur_ron_rate_micros BIGINT;
ALTER TABLE public.activities ADD COLUMN eur_ron_rate_micros BIGINT;
ALTER TABLE public.camps ADD COLUMN eur_ron_rate_micros BIGINT;

ALTER TABLE public.courses ADD CONSTRAINT courses_offer_currency_check CHECK (
    (currency = 'RON' AND eur_ron_rate_micros IS NULL) OR
    (currency = 'EUR' AND eur_ron_rate_micros IS NOT NULL AND eur_ron_rate_micros BETWEEN 1 AND 9007199254740991)
) NOT VALID;
ALTER TABLE public.activities ADD CONSTRAINT activities_offer_currency_check CHECK (
    (currency = 'RON' AND eur_ron_rate_micros IS NULL) OR
    (currency = 'EUR' AND eur_ron_rate_micros IS NOT NULL AND eur_ron_rate_micros BETWEEN 1 AND 9007199254740991)
) NOT VALID;
ALTER TABLE public.camps ADD CONSTRAINT camps_offer_currency_check CHECK (
    (currency = 'RON' AND eur_ron_rate_micros IS NULL) OR
    (currency = 'EUR' AND eur_ron_rate_micros IS NOT NULL AND eur_ron_rate_micros BETWEEN 1 AND 9007199254740991)
) NOT VALID;

ALTER TABLE public.payments ADD COLUMN pricing_snapshot JSONB;

CREATE FUNCTION public.valid_enrollment_price_snapshot(p_snapshot JSONB, p_amount BIGINT, p_currency TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    v_unit NUMERIC;
    v_quantity NUMERIC;
    v_rate NUMERIC;
    v_source NUMERIC;
    v_result NUMERIC;
BEGIN
    IF p_snapshot IS NULL THEN RETURN true; END IF;
    IF jsonb_typeof(p_snapshot) IS DISTINCT FROM 'object'
        OR NOT p_snapshot ?& ARRAY['schemaVersion','kind','entityId','childId','sourceUnitAmount',
            'sourceCurrency','quantity','eurRonRateMicros','amount','currency','priceVersion']
        OR p_snapshot->'schemaVersion' IS DISTINCT FROM '1'::JSONB
        OR (p_snapshot->>'kind' IN ('COURSE','CAMP','ACTIVITY')) IS DISTINCT FROM true
        OR (p_snapshot->>'sourceCurrency' IN ('RON','EUR')) IS DISTINCT FROM true
        OR p_snapshot->>'currency' IS DISTINCT FROM 'RON' OR p_currency IS DISTINCT FROM 'RON'
        OR (p_snapshot->>'entityId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS DISTINCT FROM true
        OR (p_snapshot->>'childId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS DISTINCT FROM true
        OR (p_snapshot->>'priceVersion' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM true
        OR jsonb_typeof(p_snapshot->'sourceUnitAmount') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'quantity') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'amount') IS DISTINCT FROM 'number'
    THEN RETURN false; END IF;
    v_unit := (p_snapshot->>'sourceUnitAmount')::NUMERIC;
    v_quantity := (p_snapshot->>'quantity')::NUMERIC;
    IF v_unit <> trunc(v_unit) OR v_unit NOT BETWEEN 0 AND 9007199254740991
        OR v_quantity <> trunc(v_quantity) OR v_quantity NOT BETWEEN 1 AND 9007199254740991
        OR (p_snapshot->>'kind' <> 'COURSE' AND v_quantity <> 1)
    THEN RETURN false; END IF;
    v_source := v_unit * v_quantity;
    IF v_source > 9007199254740991 THEN RETURN false; END IF;
    IF p_snapshot->>'sourceCurrency' = 'EUR' THEN
        IF jsonb_typeof(p_snapshot->'eurRonRateMicros') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
        v_rate := (p_snapshot->>'eurRonRateMicros')::NUMERIC;
        IF v_rate <> trunc(v_rate) OR v_rate NOT BETWEEN 1 AND 9007199254740991 THEN RETURN false; END IF;
        v_result := floor((v_source * v_rate + 500000) / 1000000);
    ELSE
        IF p_snapshot->'eurRonRateMicros' IS DISTINCT FROM 'null'::JSONB THEN RETURN false; END IF;
        v_result := v_source;
    END IF;
    RETURN (v_result <= 9007199254740991 AND v_result = p_amount
        AND v_result = (p_snapshot->>'amount')::NUMERIC) IS TRUE;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN false;
END
$$;

REVOKE ALL ON FUNCTION public.valid_enrollment_price_snapshot(JSONB, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.valid_enrollment_price_snapshot(JSONB, BIGINT, TEXT) TO authenticated, service_role;

ALTER TABLE public.payments ADD CONSTRAINT payments_price_snapshot_check
CHECK (public.valid_enrollment_price_snapshot(pricing_snapshot, amount, currency));

CREATE FUNCTION public.guard_enrollment_price_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_enrollment public.enrollments;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.pricing_snapshot IS NOT NULL THEN
        IF NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot
            OR NEW.amount IS DISTINCT FROM OLD.amount
            OR NEW.currency IS DISTINCT FROM OLD.currency
            OR NEW.enrollment_id IS DISTINCT FROM OLD.enrollment_id
        THEN RAISE EXCEPTION 'Accepted payment pricing is immutable' USING ERRCODE = '23514'; END IF;
        RETURN NEW;
    END IF;
    IF NEW.pricing_snapshot IS NULL THEN RETURN NEW; END IF;
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'Only the enrollment backend can accept a price snapshot' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (OLD.gateway_txn_id IS NOT NULL OR OLD.status NOT IN ('PENDING','FAILED','CANCELLED')) THEN
        RAISE EXCEPTION 'A processed or gateway payment cannot be repriced' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO v_enrollment FROM public.enrollments WHERE id = NEW.enrollment_id;
    IF NOT FOUND OR NEW.pricing_snapshot->>'kind' IS DISTINCT FROM v_enrollment.kind
        OR NEW.pricing_snapshot->>'entityId' IS DISTINCT FROM v_enrollment.entity_id::TEXT
        OR NEW.pricing_snapshot->>'childId' IS DISTINCT FROM v_enrollment.child_id::TEXT
    THEN RAISE EXCEPTION 'Price snapshot does not match the enrollment' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.guard_enrollment_price_snapshot() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER payments_price_snapshot_guard BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_enrollment_price_snapshot();
