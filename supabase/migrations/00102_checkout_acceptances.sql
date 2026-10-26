-- Feature #554: proof that the parent accepted the terms and the offer rules
-- when placing an enrollment.
--
-- public.checkout_acceptances is append-only: one row per placed checkout with
-- the account, the enrollments it created or reused, the terms version and
-- SHA-256, the offer rules SHA-256 (text or file, as the server read them) and
-- the UTC time. Only create-enrollment writes it, through
-- save_enrollment_batch_with_acceptance(), in the same transaction as
-- save_enrollment_batch(), so an enrollment is never saved without its record.
-- The parent reads their own rows and ADMIN reads all; nobody can change or
-- delete a row, and a profile with records cannot be deleted.

CREATE TABLE public.checkout_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('COURSE', 'CAMP', 'ACTIVITY')),
    entity_id UUID NOT NULL,
    enrollment_ids UUID[] NOT NULL CHECK (cardinality(enrollment_ids) > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CARD', 'CASH')),
    terms_version TEXT NOT NULL CHECK (char_length(terms_version) BETWEEN 1 AND 20),
    terms_sha256 TEXT NOT NULL CHECK (terms_sha256 ~ '^[0-9a-f]{64}$'),
    client_terms_version TEXT CHECK (char_length(client_terms_version) <= 20),
    rules_source TEXT CHECK (rules_source IN ('TEXT', 'FILE')),
    rules_file_path TEXT CHECK (char_length(rules_file_path) <= 1024),
    rules_file_name TEXT CHECK (char_length(rules_file_name) <= 255),
    rules_sha256 TEXT CHECK (rules_sha256 ~ '^[0-9a-f]{64}$'),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT checkout_acceptances_rules_ck CHECK (
        (rules_source IS NULL) = (rules_sha256 IS NULL)
        AND (rules_source IS NOT DISTINCT FROM 'FILE') = (rules_file_path IS NOT NULL)
    )
);
CREATE INDEX checkout_acceptances_user_idx ON public.checkout_acceptances(user_id, accepted_at DESC);
CREATE INDEX checkout_acceptances_enrollments_idx ON public.checkout_acceptances USING GIN (enrollment_ids);

ALTER TABLE public.checkout_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkout_acceptances FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.checkout_acceptances TO authenticated;
GRANT SELECT, INSERT ON public.checkout_acceptances TO service_role;

CREATE POLICY checkout_acceptances_select ON public.checkout_acceptances
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

CREATE OR REPLACE FUNCTION public.checkout_acceptances_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'Jurnalul acceptărilor nu poate fi modificat.'
        USING ERRCODE = '42501', HINT = 'checkout_acceptances_append_only';
END;
$$;
REVOKE ALL ON FUNCTION public.checkout_acceptances_append_only() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER checkout_acceptances_append_only
    BEFORE UPDATE OR DELETE ON public.checkout_acceptances
    FOR EACH ROW EXECUTE FUNCTION public.checkout_acceptances_append_only();
CREATE TRIGGER checkout_acceptances_no_truncate
    BEFORE TRUNCATE ON public.checkout_acceptances
    FOR EACH STATEMENT EXECUTE FUNCTION public.checkout_acceptances_append_only();

CREATE OR REPLACE FUNCTION public.save_enrollment_batch_with_acceptance(
    p_parent_id UUID,
    p_kind TEXT,
    p_entity_id UUID,
    p_method TEXT,
    p_quotes JSONB,
    p_billing JSONB,
    p_acceptance JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_result JSONB;
    v_ids UUID[];
BEGIN
    IF p_acceptance IS NULL OR jsonb_typeof(p_acceptance) <> 'object' THEN
        RAISE EXCEPTION 'Lipsește dovada acceptării termenilor.' USING ERRCODE = '22023';
    END IF;

    v_result := public.save_enrollment_batch(p_parent_id, p_kind, p_entity_id, p_method, p_quotes, p_billing);

    SELECT array_agg(value::uuid ORDER BY ordinality)
      INTO v_ids
      FROM jsonb_array_elements_text(v_result -> 'enrollmentIds') WITH ORDINALITY;

    INSERT INTO public.checkout_acceptances (
        user_id, kind, entity_id, enrollment_ids, payment_method,
        terms_version, terms_sha256, client_terms_version,
        rules_source, rules_file_path, rules_file_name, rules_sha256
    ) VALUES (
        p_parent_id, p_kind, p_entity_id, v_ids, p_method,
        p_acceptance ->> 'termsVersion',
        p_acceptance ->> 'termsSha256',
        p_acceptance ->> 'clientTermsVersion',
        p_acceptance ->> 'rulesSource',
        p_acceptance ->> 'rulesFilePath',
        p_acceptance ->> 'rulesFileName',
        p_acceptance ->> 'rulesSha256'
    );

    RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.save_enrollment_batch_with_acceptance(UUID, TEXT, UUID, TEXT, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_enrollment_batch_with_acceptance(UUID, TEXT, UUID, TEXT, JSONB, JSONB, JSONB) TO service_role;
