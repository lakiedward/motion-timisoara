CREATE TABLE public.camp_adult_prices (
    camp_id UUID PRIMARY KEY REFERENCES public.camps(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL CHECK (amount >= 0),
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT camp_adult_prices_components_ck CHECK (
        public.componentele_categoriei_valide(components)
        AND amount = public.suma_componentelor_categoriei(components)
    )
);

ALTER TABLE public.camp_adult_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "camp_adult_prices_select" ON public.camp_adult_prices
    FOR SELECT TO anon, authenticated
    USING (camp_id IN (SELECT id FROM public.camps));

CREATE POLICY "camp_adult_prices_write" ON public.camp_adult_prices
    FOR ALL TO authenticated
    USING (public.pot_administra_tabara(camp_id))
    WITH CHECK (public.pot_administra_tabara(camp_id));

GRANT SELECT ON public.camp_adult_prices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.camp_adult_prices TO authenticated;

ALTER TABLE public.enrollments
    ADD COLUMN adult_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.enrollments
    ALTER COLUMN child_id DROP NOT NULL;

ALTER TABLE public.enrollments
    ADD CONSTRAINT enrollments_participant_xor_ck CHECK (
        (child_id IS NOT NULL AND adult_profile_id IS NULL)
        OR (child_id IS NULL AND adult_profile_id IS NOT NULL AND kind = 'CAMP')
    );

CREATE INDEX enrollments_adult_profile_idx ON public.enrollments (adult_profile_id)
    WHERE adult_profile_id IS NOT NULL;

CREATE UNIQUE INDEX enrollments_camp_adult_active_uidx
    ON public.enrollments (entity_id, adult_profile_id)
    WHERE kind = 'CAMP' AND adult_profile_id IS NOT NULL AND status IN ('PENDING', 'ACTIVE');

CREATE OR REPLACE FUNCTION public.camp_enrolled_child_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.child_id
    FROM public.enrollments e
    WHERE e.kind = 'CAMP'
      AND e.status IN ('ACTIVE', 'PENDING')
      AND e.child_id IS NOT NULL
      AND public.pot_vedea_inscrierile_taberei(e.entity_id)
$$;

DROP POLICY IF EXISTS "enrollments_select" ON public.enrollments;
CREATE POLICY "enrollments_select" ON public.enrollments
    FOR SELECT TO authenticated
    USING (
        child_id IN (SELECT public.my_child_ids())
        OR adult_profile_id = (SELECT auth.uid())
        OR (
            kind = 'COURSE'
            AND entity_id IN (SELECT id FROM public.courses WHERE coach_id = (SELECT auth.uid()))
        )
        OR (
            kind = 'ACTIVITY'
            AND entity_id IN (SELECT id FROM public.activities WHERE coach_id = (SELECT auth.uid()))
        )
        OR (
            kind = 'COURSE'
            AND entity_id IN (
                SELECT c.id FROM public.courses c
                JOIN public.clubs cl ON c.club_id = cl.id
                WHERE cl.owner_user_id = (SELECT auth.uid())
            )
        )
        OR (kind = 'CAMP' AND public.pot_vedea_inscrierile_taberei(entity_id))
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
    FOR SELECT TO authenticated
    USING (
        enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            JOIN public.children c ON e.child_id = c.id
            WHERE c.parent_id = (SELECT auth.uid())
        )
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.adult_profile_id = (SELECT auth.uid())
        )
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE (e.kind = 'COURSE' AND e.entity_id IN (SELECT id FROM public.courses WHERE coach_id = (SELECT auth.uid())))
               OR (e.kind = 'ACTIVITY' AND e.entity_id IN (SELECT id FROM public.activities WHERE coach_id = (SELECT auth.uid())))
        )
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.kind = 'COURSE' AND e.entity_id IN (
                SELECT c.id FROM public.courses c JOIN public.clubs cl ON c.club_id = cl.id
                WHERE cl.owner_user_id = (SELECT auth.uid())))
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

CREATE OR REPLACE FUNCTION public.valid_enrollment_price_snapshot(p_snapshot JSONB, p_amount BIGINT, p_currency TEXT)
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
    v_has_child BOOLEAN;
    v_has_adult BOOLEAN;
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
        OR (p_snapshot->>'priceVersion' ~ '^[0-9a-f]{64}$') IS DISTINCT FROM true
        OR jsonb_typeof(p_snapshot->'sourceUnitAmount') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'quantity') IS DISTINCT FROM 'number'
        OR jsonb_typeof(p_snapshot->'amount') IS DISTINCT FROM 'number'
    THEN RETURN false; END IF;
    v_has_child := (p_snapshot->>'childId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE;
    v_has_adult := (p_snapshot->>'adultProfileId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE;
    IF v_has_child = v_has_adult THEN RETURN false; END IF;
    IF v_has_adult AND p_snapshot->>'kind' IS DISTINCT FROM 'CAMP' THEN RETURN false; END IF;
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

CREATE OR REPLACE FUNCTION public.guard_enrollment_price_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_enrollment public.enrollments;
    v_child_ok BOOLEAN;
    v_adult_ok BOOLEAN;
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
    v_child_ok := v_enrollment.child_id IS NOT NULL
        AND NEW.pricing_snapshot->>'childId' IS NOT DISTINCT FROM v_enrollment.child_id::TEXT;
    v_adult_ok := v_enrollment.adult_profile_id IS NOT NULL
        AND NEW.pricing_snapshot->>'adultProfileId' IS NOT DISTINCT FROM v_enrollment.adult_profile_id::TEXT
        AND NEW.pricing_snapshot->>'childId' IS NULL;
    IF NOT FOUND OR NEW.pricing_snapshot->>'kind' IS DISTINCT FROM v_enrollment.kind
        OR NEW.pricing_snapshot->>'entityId' IS DISTINCT FROM v_enrollment.entity_id::TEXT
        OR (v_child_ok IS DISTINCT FROM true AND v_adult_ok IS DISTINCT FROM true)
    THEN RAISE EXCEPTION 'Price snapshot does not match the enrollment' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
END
$$;

CREATE FUNCTION public.enrollment_camp_adult_offer(p_camp_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'amount', p.amount,
        'currency', c.currency,
        'eur_ron_rate_micros', c.eur_ron_rate_micros
    )
    FROM public.camps c
    JOIN public.camp_adult_prices p ON p.camp_id = c.id
    WHERE c.id = p_camp_id
$$;

REVOKE ALL ON FUNCTION public.enrollment_camp_adult_offer(UUID) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_camp_adult_offer(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_enrollment_payment_result(
    p_payment_id UUID,
    p_result TEXT,
    p_amount BIGINT,
    p_currency TEXT,
    p_method TEXT,
    p_gateway_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_enrollment_id UUID;
    v_enrollment public.enrollments;
    v_payment public.payments;
    v_sessions INTEGER := 0;
    v_child_ok BOOLEAN;
    v_adult_ok BOOLEAN;
BEGIN
    IF p_result IS NULL OR p_result NOT IN ('SUCCEEDED', 'FAILED')
        OR p_method IS NULL OR p_method NOT IN ('CARD', 'CASH')
        OR (p_method = 'CASH' AND p_result <> 'SUCCEEDED') THEN
        RAISE EXCEPTION 'Invalid payment result' USING ERRCODE = '22023';
    END IF;

    SELECT enrollment_id INTO v_enrollment_id FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO v_enrollment FROM public.enrollments WHERE id = v_enrollment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment not found' USING ERRCODE = 'P0002'; END IF;
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND OR v_payment.enrollment_id IS DISTINCT FROM v_enrollment_id THEN
        RAISE EXCEPTION 'Payment changed during confirmation' USING ERRCODE = '40001';
    END IF;

    IF v_payment.method IS DISTINCT FROM p_method
        OR p_amount IS NULL OR p_amount < 0 OR v_payment.amount IS DISTINCT FROM p_amount
        OR p_currency IS DISTINCT FROM 'RON' OR v_payment.currency IS DISTINCT FROM p_currency
        OR (p_method = 'CARD' AND (p_gateway_id IS NULL OR p_gateway_id = ''
            OR v_payment.gateway_txn_id IS DISTINCT FROM p_gateway_id))
        OR (p_method = 'CASH' AND (p_gateway_id IS NOT NULL OR v_payment.gateway_txn_id IS NOT NULL)) THEN
        RAISE EXCEPTION 'Payment does not match the accepted charge' USING ERRCODE = '23514';
    END IF;

    IF v_payment.status IN ('SUCCEEDED', 'REFUNDED', 'PARTIAL') THEN
        RETURN jsonb_build_object('changed', false, 'status', v_payment.status,
            'enrollmentId', v_enrollment.id, 'sessionsAdded', 0);
    END IF;
    IF v_payment.status NOT IN ('PENDING', 'FAILED') OR v_enrollment.status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Payment is not awaiting confirmation' USING ERRCODE = '23514';
    END IF;

    IF p_result = 'FAILED' THEN
        UPDATE public.payments SET status = 'FAILED', updated_at = now() WHERE id = p_payment_id;
        RETURN jsonb_build_object('changed', v_payment.status <> 'FAILED', 'status', 'FAILED',
            'enrollmentId', v_enrollment.id, 'sessionsAdded', 0);
    END IF;

    IF public.valid_enrollment_price_snapshot(v_payment.pricing_snapshot, v_payment.amount, v_payment.currency) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Invalid accepted price' USING ERRCODE = '23514';
    END IF;
    v_child_ok := v_enrollment.child_id IS NOT NULL
        AND v_payment.pricing_snapshot->>'childId' IS NOT DISTINCT FROM v_enrollment.child_id::TEXT;
    v_adult_ok := v_enrollment.adult_profile_id IS NOT NULL
        AND v_payment.pricing_snapshot->>'adultProfileId' IS NOT DISTINCT FROM v_enrollment.adult_profile_id::TEXT
        AND v_payment.pricing_snapshot->>'childId' IS NULL;
    IF v_payment.pricing_snapshot IS NOT NULL AND (
        v_payment.pricing_snapshot->>'kind' IS DISTINCT FROM v_enrollment.kind
        OR v_payment.pricing_snapshot->>'entityId' IS DISTINCT FROM v_enrollment.entity_id::TEXT
        OR (v_child_ok IS DISTINCT FROM true AND v_adult_ok IS DISTINCT FROM true)
    ) THEN
        RAISE EXCEPTION 'Accepted price does not match enrollment' USING ERRCODE = '23514';
    END IF;
    IF v_enrollment.kind = 'COURSE' THEN
        IF v_payment.pricing_snapshot IS NULL THEN
            RAISE EXCEPTION 'Legacy course payment requires verified session quantity' USING ERRCODE = '23514';
        END IF;
        v_sessions := (v_payment.pricing_snapshot->>'quantity')::INTEGER;
    END IF;

    UPDATE public.enrollments SET status = 'ACTIVE',
        purchased_sessions = purchased_sessions + v_sessions,
        remaining_sessions = remaining_sessions + v_sessions
    WHERE id = v_enrollment.id;
    UPDATE public.payments SET status = 'SUCCEEDED', paid_at = now(), updated_at = now()
    WHERE id = p_payment_id;
    RETURN jsonb_build_object('changed', true, 'status', 'SUCCEEDED',
        'enrollmentId', v_enrollment.id, 'sessionsAdded', v_sessions);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_enrollment_batch(
    p_parent_id UUID,
    p_kind TEXT,
    p_entity_id UUID,
    p_method TEXT,
    p_quotes JSONB,
    p_billing JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_offer JSONB;
    v_quote JSONB;
    v_snapshot JSONB;
    v_child public.children;
    v_enrollment public.enrollments;
    v_payment public.payments;
    v_child_id UUID;
    v_adult_id UUID;
    v_count INTEGER;
    v_occupied INTEGER;
    v_amount BIGINT;
    v_source JSONB;
    v_ids JSONB := '[]'::JSONB;
    v_created JSONB := '[]'::JSONB;
    v_prices JSONB := '[]'::JSONB;
    v_exists BOOLEAN;
    v_needs_card BOOLEAN;
    v_price_row JSONB;
BEGIN
    IF p_parent_id IS NULL OR p_entity_id IS NULL
        OR p_kind IS NULL OR p_kind NOT IN ('COURSE','ACTIVITY','CAMP')
        OR p_method IS NULL OR p_method NOT IN ('CARD','CASH')
        OR jsonb_typeof(p_quotes) IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_quotes) = 0
        OR (p_billing IS NOT NULL AND jsonb_typeof(p_billing) IS DISTINCT FROM 'object') THEN
        RAISE EXCEPTION 'Cererea de înscriere nu este validă.' USING ERRCODE = '22023';
    END IF;
    PERFORM 1 FROM public.profiles WHERE id = p_parent_id AND role = 'PARENT' FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Doar părinții pot înscrie copii.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quotes) q
        WHERE ((q->>'childId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE)
            = ((q->>'adultProfileId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS TRUE)
    ) THEN
        RAISE EXCEPTION 'Selecția participanților nu este validă.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quotes) q
        WHERE q->>'adultProfileId' IS NOT NULL AND p_kind IS DISTINCT FROM 'CAMP'
    ) THEN
        RAISE EXCEPTION 'Selecția participanților nu este validă.' USING ERRCODE = '22023';
    END IF;
    IF (SELECT count(*) FROM (
            SELECT DISTINCT COALESCE(q->>'childId', '') || ':' || COALESCE(q->>'adultProfileId', '')
            FROM jsonb_array_elements(p_quotes) q
        ) s) <> jsonb_array_length(p_quotes) THEN
        RAISE EXCEPTION 'Selecția copiilor nu este validă.' USING ERRCODE = '22023';
    END IF;

    IF p_kind = 'COURSE' THEN
        SELECT to_jsonb(c) INTO v_offer FROM public.courses c WHERE id = p_entity_id FOR UPDATE;
    ELSIF p_kind = 'ACTIVITY' THEN
        SELECT to_jsonb(a) INTO v_offer FROM public.activities a WHERE id = p_entity_id FOR UPDATE;
    ELSE
        SELECT to_jsonb(c) INTO v_offer FROM public.camps c WHERE id = p_entity_id FOR UPDATE;
    END IF;
    IF v_offer IS NULL THEN
        RAISE EXCEPTION 'Oferta nu a fost găsită.' USING ERRCODE = 'P0002';
    END IF;
    IF p_kind <> 'CAMP' AND (v_offer->>'active')::BOOLEAN IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Oferta nu mai este activă.' USING ERRCODE = '23514';
    END IF;
    IF p_kind = 'CAMP' AND p_method = 'CASH' AND (v_offer->>'allow_cash')::BOOLEAN IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Plata cash nu este disponibilă pentru această tabără.' USING ERRCODE = '23514';
    END IF;

    FOR v_quote IN SELECT q FROM jsonb_array_elements(p_quotes) q
        ORDER BY COALESCE(q->>'childId', q->>'adultProfileId')
    LOOP
        v_child_id := NULLIF(v_quote->>'childId', '')::UUID;
        v_adult_id := NULLIF(v_quote->>'adultProfileId', '')::UUID;
        v_amount := (v_quote->>'amount')::BIGINT;
        v_snapshot := nullif(v_quote->'snapshot', 'null'::JSONB);
        IF v_amount IS NULL OR v_amount < 0 OR v_amount > 9007199254740991
            OR v_quote->>'currency' IS DISTINCT FROM 'RON'
            OR public.valid_enrollment_price_snapshot(v_snapshot, v_amount, 'RON') IS DISTINCT FROM true
            OR (v_snapshot IS NOT NULL AND (
                v_snapshot->>'kind' IS DISTINCT FROM p_kind
                OR v_snapshot->>'entityId' IS DISTINCT FROM p_entity_id::TEXT
                OR v_snapshot->>'priceVersion' IS DISTINCT FROM v_quote->>'priceVersion'
                OR (v_child_id IS NOT NULL AND v_snapshot->>'childId' IS DISTINCT FROM v_child_id::TEXT)
                OR (v_adult_id IS NOT NULL AND (
                    v_snapshot->>'adultProfileId' IS DISTINCT FROM v_adult_id::TEXT
                    OR v_snapshot->>'childId' IS NOT NULL)))) THEN
            RAISE EXCEPTION 'Oferta confirmată nu este validă.' USING ERRCODE = '23514';
        END IF;
        IF v_adult_id IS NOT NULL THEN
            IF v_adult_id IS DISTINCT FROM p_parent_id THEN
                RAISE EXCEPTION 'Poți să te înscrii doar pe tine ca adult.' USING ERRCODE = '42501';
            END IF;
            PERFORM 1 FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND adult_profile_id = v_adult_id AND status IN ('PENDING','ACTIVE') ORDER BY id FOR UPDATE;
            SELECT count(*) INTO v_count FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND adult_profile_id = v_adult_id AND status IN ('PENDING','ACTIVE');
            IF v_count > 1 THEN
                RAISE EXCEPTION 'Înscrierea are nevoie de verificare. Contactează clubul.' USING ERRCODE = '23514';
            END IF;
            SELECT * INTO v_enrollment FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND adult_profile_id = v_adult_id AND status IN ('PENDING','ACTIVE');
        ELSE
            SELECT * INTO v_child FROM public.children WHERE id = v_child_id FOR SHARE;
            IF NOT FOUND OR v_child.parent_id IS DISTINCT FROM p_parent_id THEN
                RAISE EXCEPTION 'Copilul nu îți aparține.' USING ERRCODE = '42501';
            END IF;
            IF p_kind = 'COURSE' AND (
                extract(year FROM age(current_date, v_child.birth_date)) < (v_offer->>'age_from')::INTEGER
                OR extract(year FROM age(current_date, v_child.birth_date)) > (v_offer->>'age_to')::INTEGER) THEN
                RAISE EXCEPTION 'Vârsta copilului nu corespunde cursului.' USING ERRCODE = '23514';
            END IF;
            PERFORM 1 FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND child_id = v_child_id AND status IN ('PENDING','ACTIVE') ORDER BY id FOR UPDATE;
            SELECT count(*) INTO v_count FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND child_id = v_child_id AND status IN ('PENDING','ACTIVE');
            IF v_count > 1 THEN
                RAISE EXCEPTION 'Înscrierea are nevoie de verificare. Contactează clubul.' USING ERRCODE = '23514';
            END IF;
            SELECT * INTO v_enrollment FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id
                AND child_id = v_child_id AND status IN ('PENDING','ACTIVE');
        END IF;
        v_exists := FOUND;
        v_payment := NULL;
        IF v_exists THEN
            IF p_method = 'CASH' THEN
                RAISE EXCEPTION 'Există deja o înscriere. Verifică în Înscrieri.' USING ERRCODE = '23514';
            END IF;
            PERFORM 1 FROM public.payments WHERE enrollment_id = v_enrollment.id ORDER BY id FOR UPDATE;
            SELECT count(*) INTO v_count FROM public.payments WHERE enrollment_id = v_enrollment.id;
            IF v_count > 1 THEN
                RAISE EXCEPTION 'Plata are nevoie de verificare. Contactează clubul.' USING ERRCODE = '23514';
            END IF;
            SELECT * INTO v_payment FROM public.payments WHERE enrollment_id = v_enrollment.id;
            IF v_enrollment.status = 'ACTIVE' THEN
                IF v_payment.id IS NULL OR v_payment.status <> 'SUCCEEDED' OR v_snapshot IS NULL
                    OR v_payment.pricing_snapshot IS DISTINCT FROM v_snapshot
                    OR v_payment.amount IS DISTINCT FROM v_amount OR v_payment.currency <> 'RON'
                    OR (v_amount > 0 AND (v_payment.method <> 'CARD' OR v_payment.gateway_txn_id IS NULL)) THEN
                    RAISE EXCEPTION 'Înscrierea este deja procesată. Verifică în Înscrieri.' USING ERRCODE = '23514';
                END IF;
                v_ids := v_ids || jsonb_build_array(v_enrollment.id);
                v_price_row := jsonb_build_object('amount',v_amount,'currency','RON');
                IF v_child_id IS NOT NULL THEN v_price_row := v_price_row || jsonb_build_object('childId',v_child_id); END IF;
                IF v_adult_id IS NOT NULL THEN v_price_row := v_price_row || jsonb_build_object('adultProfileId',v_adult_id); END IF;
                v_prices := v_prices || jsonb_build_array(v_price_row);
                CONTINUE;
            END IF;
            IF v_payment.id IS NOT NULL AND v_payment.status NOT IN ('PENDING','FAILED','CANCELLED') THEN
                RAISE EXCEPTION 'Plata este deja procesată. Verifică în Înscrieri.' USING ERRCODE = '23514';
            END IF;
        END IF;

        IF v_payment.gateway_txn_id IS NOT NULL OR v_payment.pricing_snapshot IS NOT NULL THEN
            IF v_payment.amount IS DISTINCT FROM v_amount OR v_payment.currency IS DISTINCT FROM 'RON'
                OR v_payment.pricing_snapshot IS DISTINCT FROM v_snapshot THEN
                RAISE EXCEPTION 'Plata s-a schimbat. Verifică din nou înscrierea.' USING ERRCODE = '23514', DETAIL = 'PRICE_CHANGED';
            END IF;
        ELSE
            IF v_snapshot IS NULL THEN
                RAISE EXCEPTION 'Lipsește oferta confirmată.' USING ERRCODE = '23514';
            END IF;
            IF p_kind = 'CAMP' AND v_adult_id IS NOT NULL THEN
                v_source := public.enrollment_camp_adult_offer(p_entity_id);
            ELSIF p_kind = 'CAMP' THEN
                v_source := public.enrollment_camp_offer(p_entity_id, v_child_id);
            ELSE
                v_source := jsonb_build_object('amount', CASE WHEN p_kind = 'COURSE' THEN v_offer->'price_per_session' ELSE v_offer->'price' END,
                    'currency',v_offer->'currency','eur_ron_rate_micros',v_offer->'eur_ron_rate_micros');
            END IF;
            IF v_source IS NULL OR v_source->'amount' IS DISTINCT FROM v_snapshot->'sourceUnitAmount'
                OR v_source->'currency' IS DISTINCT FROM v_snapshot->'sourceCurrency'
                OR coalesce(v_source->'eur_ron_rate_micros','null'::JSONB) IS DISTINCT FROM v_snapshot->'eurRonRateMicros' THEN
                RAISE EXCEPTION 'Prețul s-a schimbat. Revino la Detalii și confirmă suma.' USING ERRCODE = '23514', DETAIL = 'PRICE_CHANGED';
            END IF;
        END IF;

        IF NOT v_exists THEN
            SELECT count(*) INTO v_occupied FROM public.enrollments WHERE kind = p_kind AND entity_id = p_entity_id AND status IN ('PENDING','ACTIVE');
            IF (v_offer->>'capacity')::INTEGER IS NOT NULL AND v_occupied >= (v_offer->>'capacity')::INTEGER THEN
                RAISE EXCEPTION 'Nu mai sunt locuri suficiente pentru selecția ta.' USING ERRCODE = '23514';
            END IF;
            INSERT INTO public.enrollments(kind,entity_id,child_id,adult_profile_id,status,purchased_sessions,remaining_sessions,sessions_used)
                VALUES(p_kind,p_entity_id,v_child_id,v_adult_id,'PENDING',0,0,0) RETURNING * INTO v_enrollment;
            v_created := v_created || jsonb_build_array(v_enrollment.id);
        END IF;
        IF v_payment.id IS NULL THEN
            INSERT INTO public.payments(enrollment_id,method,amount,currency,pricing_snapshot,status,
                billing_name,billing_email,billing_address_line1,billing_city,billing_postal_code,billing_country)
            VALUES(v_enrollment.id,p_method,v_amount,'RON',v_snapshot,'PENDING',
                CASE WHEN p_method='CARD' THEN p_billing->>'name' END,CASE WHEN p_method='CARD' THEN p_billing->>'email' END,
                CASE WHEN p_method='CARD' THEN p_billing->>'addressLine1' END,CASE WHEN p_method='CARD' THEN p_billing->>'city' END,
                CASE WHEN p_method='CARD' THEN p_billing->>'postalCode' END,CASE WHEN p_method='CARD' AND p_billing IS NOT NULL THEN 'RO' END);
        ELSIF v_payment.method IS DISTINCT FROM p_method OR v_payment.status <> 'PENDING' OR p_billing IS NOT NULL
            OR (v_payment.gateway_txn_id IS NULL AND v_payment.pricing_snapshot IS NULL) THEN
            UPDATE public.payments SET method=p_method,status='PENDING',updated_at=now(),
                amount=v_amount,currency='RON',pricing_snapshot=v_snapshot,
                billing_name=CASE WHEN p_billing IS NULL THEN billing_name ELSE p_billing->>'name' END,
                billing_email=CASE WHEN p_billing IS NULL THEN billing_email ELSE p_billing->>'email' END,
                billing_address_line1=CASE WHEN p_billing IS NULL THEN billing_address_line1 ELSE p_billing->>'addressLine1' END,
                billing_city=CASE WHEN p_billing IS NULL THEN billing_city ELSE p_billing->>'city' END,
                billing_postal_code=CASE WHEN p_billing IS NULL THEN billing_postal_code ELSE p_billing->>'postalCode' END,
                billing_country=CASE WHEN p_billing IS NULL THEN billing_country ELSE 'RO' END
            WHERE id=v_payment.id;
        END IF;
        IF v_amount = 0 THEN
            UPDATE public.enrollments SET status = 'ACTIVE' WHERE id = v_enrollment.id;
            UPDATE public.payments SET status = 'SUCCEEDED', paid_at = COALESCE(paid_at, now()), updated_at = now()
                WHERE enrollment_id = v_enrollment.id AND amount = 0 AND status = 'PENDING';
        END IF;
        v_ids := v_ids || jsonb_build_array(v_enrollment.id);
        v_price_row := jsonb_build_object('amount',v_amount,'currency','RON');
        IF v_child_id IS NOT NULL THEN v_price_row := v_price_row || jsonb_build_object('childId',v_child_id); END IF;
        IF v_adult_id IS NOT NULL THEN v_price_row := v_price_row || jsonb_build_object('adultProfileId',v_adult_id); END IF;
        v_prices := v_prices || jsonb_build_array(v_price_row);
    END LOOP;
    SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_quotes) q WHERE COALESCE((q->>'amount')::BIGINT, 0) > 0
    ) INTO v_needs_card;
    RETURN jsonb_build_object('enrollmentId',v_ids->>0,'enrollmentIds',v_ids,'createdEnrollmentIds',v_created,
        'prices',v_prices,'requiresPaymentIntent',p_method='CARD' AND v_needs_card);
END;
$$;

CREATE OR REPLACE FUNCTION public.salveaza_pretul_adult(
    p_camp_id UUID,
    p_adult JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_amount BIGINT;
    v_components JSONB;
BEGIN
    IF public.pot_administra_tabara(p_camp_id) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Nu ai voie sa schimbi preturile acestei tabere' USING ERRCODE = '42501';
    END IF;
    IF p_adult IS NULL THEN
        RETURN;
    END IF;
    IF jsonb_typeof(p_adult) IS DISTINCT FROM 'object'
        OR coalesce((p_adult->>'amount')::BIGINT, -1) < 0 THEN
        RAISE EXCEPTION 'Pretul adult are nevoie de o suma valida' USING ERRCODE = 'P0001';
    END IF;
    v_amount := (p_adult->>'amount')::BIGINT;
    IF jsonb_typeof(p_adult->'components') = 'array'
       AND jsonb_array_length(p_adult->'components') > 0 THEN
        SELECT jsonb_agg(jsonb_build_object(
                   'name', btrim(item->>'name'),
                   'amount', (item->>'amount')::BIGINT
               ) ORDER BY ord)
        INTO v_components
        FROM jsonb_array_elements(p_adult->'components') WITH ORDINALITY AS t(item, ord);
        IF NOT public.componentele_categoriei_valide(v_components) THEN
            RAISE EXCEPTION 'Fiecare componenta are nevoie de un nume si o suma valida' USING ERRCODE = 'P0001';
        END IF;
        IF public.suma_componentelor_categoriei(v_components) IS DISTINCT FROM v_amount THEN
            RAISE EXCEPTION 'Suma componentelor (%) nu da pretul adult (%)',
                public.suma_componentelor_categoriei(v_components), v_amount
                USING ERRCODE = 'P0001';
        END IF;
    ELSE
        v_components := jsonb_build_array(jsonb_build_object('name', 'Participare', 'amount', v_amount));
    END IF;
    INSERT INTO public.camp_adult_prices (camp_id, amount, components)
    VALUES (p_camp_id, v_amount, v_components)
    ON CONFLICT (camp_id) DO UPDATE SET amount = EXCLUDED.amount, components = EXCLUDED.components;
END;
$$;

REVOKE ALL ON FUNCTION public.salveaza_pretul_adult(UUID, JSONB) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.salveaza_pretul_adult(UUID, JSONB) TO authenticated;

DROP FUNCTION IF EXISTS public.save_camp_offer_pricing(UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB);
CREATE FUNCTION public.save_camp_offer_pricing(
    p_camp_id UUID,
    p_price BIGINT,
    p_currency TEXT,
    p_eur_ron_rate_micros BIGINT,
    p_breakdown JSONB,
    p_pricing_mode TEXT,
    p_age_prices JSONB,
    p_adult_price JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF public.pot_administra_tabara(p_camp_id) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Nu ai voie sa schimbi preturile acestei tabere'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM public.camps WHERE id = p_camp_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tabara nu a fost gasita' USING ERRCODE = 'P0002';
    END IF;

    IF p_price IS NULL OR p_price NOT BETWEEN 0 AND 9007199254740991
       OR p_currency IS NULL OR p_currency NOT IN ('RON', 'EUR')
       OR (p_currency = 'RON' AND p_eur_ron_rate_micros IS NOT NULL)
       OR (p_currency = 'EUR' AND (p_eur_ron_rate_micros IS NULL
           OR p_eur_ron_rate_micros NOT BETWEEN 1 AND 9007199254740991))
       OR p_pricing_mode IS NULL OR p_pricing_mode NOT IN ('single', 'by_age')
       OR jsonb_typeof(p_breakdown) IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_age_prices) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Pretul, moneda sau cursul sunt invalide' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_breakdown || p_age_prices) item
        WHERE jsonb_typeof(item->'amount') IS DISTINCT FROM 'number'
            OR (item->>'amount')::NUMERIC NOT BETWEEN 0 AND 9007199254740991
            OR trunc((item->>'amount')::NUMERIC) <> (item->>'amount')::NUMERIC
    ) THEN
        RAISE EXCEPTION 'Sumele categoriilor sunt invalide' USING ERRCODE = '22023';
    END IF;

    UPDATE public.camps
    SET currency = p_currency, eur_ron_rate_micros = p_eur_ron_rate_micros
    WHERE id = p_camp_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Nu ai voie sa schimbi preturile acestei tabere'
            USING ERRCODE = '42501';
    END IF;

    PERFORM public.salveaza_banii_taberei(p_camp_id, p_price, p_breakdown);
    PERFORM public.salveaza_preturile_pe_varsta(p_camp_id, p_pricing_mode, p_age_prices);
    PERFORM public.salveaza_pretul_adult(p_camp_id, p_adult_price);
END;
$$;

REVOKE ALL ON FUNCTION public.save_camp_offer_pricing(UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB, JSONB)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_camp_offer_pricing(UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB, JSONB)
    TO authenticated;

DROP FUNCTION IF EXISTS public.save_camp_offer(UUID, JSONB, UUID, UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB);
CREATE FUNCTION public.save_camp_offer(
    p_camp_id UUID,
    p_metadata JSONB,
    p_club_id UUID,
    p_coach_id UUID,
    p_price BIGINT,
    p_currency TEXT,
    p_eur_ron_rate_micros BIGINT,
    p_breakdown JSONB,
    p_pricing_mode TEXT,
    p_age_prices JSONB,
    p_adult_price JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fields public.camps;
    v_rules TEXT;
BEGIN
    IF p_camp_id IS NULL OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Invalid camp data' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_fields FROM jsonb_populate_record(NULL::public.camps, p_metadata);
    v_rules := CASE
        WHEN p_metadata ? 'rules' THEN NULLIF(btrim(COALESCE(v_fields.rules, '')), '')
        ELSE NULL
    END;
    IF NOT EXISTS (SELECT FROM public.camps WHERE id = p_camp_id) THEN
        INSERT INTO public.camps(id, club_id, coach_id, title, slug, description, rules,
            period_start, period_end, location_id, location_text, capacity, allow_cash,
            camp_requirements, price, currency, eur_ron_rate_micros)
        VALUES (p_camp_id, p_club_id, p_coach_id, v_fields.title, v_fields.slug, v_fields.description, v_rules,
            v_fields.period_start, v_fields.period_end, v_fields.location_id, v_fields.location_text,
            v_fields.capacity, v_fields.allow_cash, COALESCE(v_fields.camp_requirements, '[]'::jsonb),
            p_price, p_currency, p_eur_ron_rate_micros)
        ON CONFLICT (id) DO NOTHING;
    END IF;
    IF public.pot_administra_tabara(p_camp_id) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Camp is not owned by caller' USING ERRCODE = '42501';
    END IF;
    UPDATE public.camps SET title = v_fields.title, slug = v_fields.slug,
        description = v_fields.description,
        rules = CASE WHEN p_metadata ? 'rules' THEN v_rules ELSE camps.rules END,
        period_start = v_fields.period_start,
        period_end = v_fields.period_end, location_id = v_fields.location_id,
        location_text = v_fields.location_text, capacity = v_fields.capacity,
        allow_cash = v_fields.allow_cash,
        camp_requirements = COALESCE(v_fields.camp_requirements, camps.camp_requirements)
    WHERE id = p_camp_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Camp cannot be updated' USING ERRCODE = '42501';
    END IF;
    PERFORM public.save_camp_offer_pricing(p_camp_id, p_price, p_currency,
        p_eur_ron_rate_micros, p_breakdown, p_pricing_mode, p_age_prices, p_adult_price);
END;
$$;

REVOKE ALL ON FUNCTION public.save_camp_offer(UUID, JSONB, UUID, UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB, JSONB)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_camp_offer(UUID, JSONB, UUID, UUID, BIGINT, TEXT, BIGINT, JSONB, TEXT, JSONB, JSONB)
    TO authenticated;
