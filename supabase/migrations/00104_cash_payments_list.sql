-- Bug #1283: the coach, the club and ADMIN can confirm a cash payment for a
-- course, activity or camp from the app.
--
-- Confirmation already runs in the mark-cash-paid edge function. What was
-- missing is the list: payments RLS hides club activity and camp payments
-- from the owning club. This read-only SECURITY DEFINER function returns the
-- cash payments the caller may confirm, with the same rule as mark-cash-paid:
-- ADMIN sees all, a COACH the offers whose coach_id is the caller, a CLUB the
-- offers of the club it owns. Competitions keep get_competition_cash_payments.
-- Confirmed payments are listed for 90 days. No table, policy or grant on an
-- existing object changes; only authenticated may execute.

CREATE OR REPLACE FUNCTION public.get_cash_payments()
RETURNS TABLE (
    payment_id UUID,
    enrollment_id UUID,
    kind TEXT,
    entity_id UUID,
    offer_title TEXT,
    participant_name TEXT,
    is_adult BOOLEAN,
    sessions INTEGER,
    amount BIGINT,
    currency TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_role TEXT;
BEGIN
    SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_uid;
    IF v_uid IS NULL OR v_role IS NULL OR v_role NOT IN ('COACH', 'CLUB', 'ADMIN') THEN
        RAISE EXCEPTION 'Nu ai acces la plățile cash'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH offers AS (
        SELECT 'COURSE'::TEXT AS kind, c.id, c.name AS title, c.coach_id, c.club_id
        FROM public.courses c
        UNION ALL
        SELECT 'ACTIVITY', a.id, a.name, a.coach_id, a.club_id
        FROM public.activities a
        UNION ALL
        SELECT 'CAMP', t.id, t.title, t.coach_id, t.club_id
        FROM public.camps t
    )
    SELECT payment.id, enrollment.id, enrollment.kind, enrollment.entity_id,
        offer.title, COALESCE(child.name, adult.name), enrollment.child_id IS NULL,
        CASE WHEN enrollment.kind = 'COURSE'
            THEN (payment.pricing_snapshot->>'quantity')::INTEGER END,
        payment.amount, payment.currency, payment.status,
        payment.created_at, payment.paid_at
    FROM public.payments payment
    JOIN public.enrollments enrollment ON enrollment.id = payment.enrollment_id
    JOIN offers offer ON offer.kind = enrollment.kind AND offer.id = enrollment.entity_id
    LEFT JOIN public.clubs club ON club.id = offer.club_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    WHERE payment.method = 'CASH'
      AND enrollment.status <> 'CANCELLED'
      AND (payment.status = 'PENDING'
        OR (payment.status = 'SUCCEEDED' AND payment.paid_at > now() - INTERVAL '90 days'))
      AND (v_role = 'ADMIN'
        OR (v_role = 'COACH' AND offer.coach_id = v_uid)
        OR (v_role = 'CLUB' AND club.owner_user_id = v_uid))
    ORDER BY payment.status = 'PENDING' DESC, payment.created_at DESC, payment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cash_payments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_payments() TO authenticated;
