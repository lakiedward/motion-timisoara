-- Conturile dezactivate de antrenor și club nu mai citesc copiii de la cursuri,
-- activități și concursuri.
--
-- Bug TT #1366, continuarea lui #1364 (00129 a închis taberele și toate ramurile
-- ADMIN prin `get_my_role()`). Dezactivarea din admin schimbă doar
-- `profiles.enabled`; sesiunea rămâne valabilă. Ramurile care comparau direct
-- `auth.uid()` cu proprietarul ofertei nu verificau contul, așa că un antrenor
-- sau club dezactivat citea în continuare prin API:
--   - fișele copiilor (`children_select` prin `coach_enrolled_child_ids()` și
--     `club_enrolled_child_ids()`);
--   - înscrierile la cursuri și activități (`enrollments_select`) și, prin ele,
--     `monthly_payments` și `invoices`;
--   - prezențele de la cursuri (`attendance_select`) și activități
--     (`pot_administra_activitate()`);
--   - înscrierile, podiumul și plățile cash ale concursurilor
--     (`pot_administra_concurs()`, `can_view_competition_registrations()`);
--   - listele de plăți cash și totalul lunar online (`get_cash_payments()`,
--     `get_card_payments_month()`), care citeau rolul direct din `profiles`;
--   - și putea accepta o invitație la concurs, ca să primească acces la înscrieri
--     (`respond_to_competition_invitation()`).
--
-- Regula e `private.caller_is_active()` din 00129 (cont `enabled`, fără
-- `deleted_at`). Funcțiile SECURITY DEFINER o cheamă direct; politicile, care
-- rulează ca utilizatorul, folosesc `get_my_role() IS NOT NULL`, aceeași regulă
-- expusă clienților. `my_club_ids()` întoarce nimic pentru un cont inactiv, deci
-- și politicile de club care îl folosesc se închid.
--
-- Rămân neschimbate ramurile părintelui și ale adultului înscris (propriile
-- date), ca în 00129. Scrierile antrenorului pe ofertele proprii care compară
-- direct `auth.uid()` (de ex. `courses_update`) nu sunt atinse aici: blocarea
-- contului în Supabase Auth la dezactivare e un To-Do separat.
--
-- Fiecare funcție e înlocuită doar dacă sursa din bază e cea verificată pe
-- 2026-11-06, iar politicile doar dacă au încă forma din migrațiile vechi.
-- Altfel migrația se oprește în loc s-o calce.

DO $$
DECLARE
    v_expected JSONB := jsonb_build_object(
        'my_club_ids', '9c8cb14b508f9dc6844f5c2681ce630b',
        'coach_enrolled_child_ids', '27383413aa8e5c4d466fe38014a28c6f',
        'club_enrolled_child_ids', '599ded5a2cc01f91f3bda8e4562b30c4',
        'pot_administra_curs', '52ae6bfb75ce4efe54cfa47becff172a',
        'pot_administra_activitate', '7e2495d21b1d395615b2f5cd05d0e276',
        'pot_administra_concurs', 'd4a21bfd7bbcc06086deeb37f1b5da38',
        'can_view_competition_registrations', '8e05b15a52e147fb15dfcf3bc45dad34',
        'respond_to_competition_invitation', 'd746b7eee0533868dd087b73baa1b4b2',
        'get_cash_payments', 'dc644f945754056a4b6186b5f96b4744',
        'get_card_payments_month', '31a3036ca5e0a053808b9874cce5719e');
    v_name TEXT;
    v_md5 TEXT;
    v_enrollments TEXT;
    v_attendance TEXT;
BEGIN
    IF to_regprocedure('private.caller_is_active()') IS NULL THEN
        RAISE EXCEPTION 'Lipsește private.caller_is_active() din 00129; aplică 00129 înainte de 00132.';
    END IF;

    FOR v_name IN SELECT jsonb_object_keys(v_expected) LOOP
        SELECT md5(p.prosrc) INTO v_md5
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = v_name;

        IF v_md5 IS DISTINCT FROM v_expected->>v_name THEN
            RAISE EXCEPTION '% nu mai e sursa verificată (md5 %); compară înainte de înlocuire.', v_name, v_md5;
        END IF;
    END LOOP;

    SELECT qual INTO v_enrollments FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'enrollments' AND policyname = 'enrollments_select';
    SELECT qual INTO v_attendance FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attendance' AND policyname = 'attendance_select';

    IF v_enrollments IS NULL
       OR v_enrollments NOT LIKE '%courses.coach_id = ( SELECT %uid()%'
       OR v_enrollments NOT LIKE '%activities.coach_id = ( SELECT %uid()%'
       OR v_enrollments NOT LIKE '%cl.owner_user_id = ( SELECT %uid()%'
       OR v_enrollments NOT LIKE '%pot_vedea_inscrierile_taberei(entity_id)%'
       OR v_enrollments LIKE '%get_my_role) IS NOT NULL%' THEN
        RAISE EXCEPTION 'enrollments_select nu mai are forma verificată pe 2026-11-06. Recitește-o înainte de 00132.';
    END IF;

    IF v_attendance IS NULL
       OR v_attendance NOT LIKE '%c.coach_id = ( SELECT %uid()%'
       OR v_attendance NOT LIKE '%cl.owner_user_id = ( SELECT %uid()%'
       OR v_attendance LIKE '%get_my_role) IS NOT NULL%' THEN
        RAISE EXCEPTION 'attendance_select nu mai are forma verificată pe 2026-11-06. Recitește-o înainte de 00132.';
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.my_club_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT c.id FROM public.clubs c
    WHERE c.owner_user_id = (SELECT auth.uid())
      AND (SELECT private.caller_is_active())
$$;

CREATE OR REPLACE FUNCTION public.coach_enrolled_child_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT e.child_id FROM public.enrollments e
    JOIN public.courses c ON e.entity_id = c.id AND e.kind = 'COURSE'
    WHERE c.coach_id = (SELECT auth.uid()) AND e.status = 'ACTIVE'
      AND (SELECT private.caller_is_active())
    UNION
    SELECT e.child_id FROM public.enrollments e
    JOIN public.activities a ON e.entity_id = a.id AND e.kind = 'ACTIVITY'
    WHERE a.coach_id = (SELECT auth.uid()) AND e.status = 'ACTIVE'
      AND (SELECT private.caller_is_active())
$$;

CREATE OR REPLACE FUNCTION public.club_enrolled_child_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT e.child_id FROM public.enrollments e
    JOIN public.courses c ON e.entity_id = c.id AND e.kind = 'COURSE'
    JOIN public.clubs cl ON c.club_id = cl.id
    WHERE cl.owner_user_id = (SELECT auth.uid()) AND e.status = 'ACTIVE'
      AND (SELECT private.caller_is_active())
$$;

CREATE OR REPLACE FUNCTION public.pot_administra_curs(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (SELECT private.caller_is_active())
        AND (
            EXISTS (
                SELECT 1 FROM public.courses c
                WHERE c.id = p_course_id
                  AND (
                      c.club_id IN (SELECT my_club_ids())
                      OR c.coach_id = (SELECT auth.uid())
                  )
            ) OR (SELECT get_my_role()) = 'ADMIN'
        )
$$;

CREATE OR REPLACE FUNCTION public.pot_administra_activitate(p_activity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT (SELECT private.caller_is_active())
        AND (
            EXISTS (
                SELECT 1 FROM public.activities a
                WHERE a.id = p_activity_id
                  AND (
                      a.club_id IN (SELECT my_club_ids())
                      OR a.coach_id = (SELECT auth.uid())
                  )
            ) OR (SELECT get_my_role()) = 'ADMIN'
        )
$$;

CREATE OR REPLACE FUNCTION public.pot_administra_concurs(p_competition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT (SELECT private.caller_is_active())
        AND (
            EXISTS (
                SELECT 1 FROM public.competitions c
                WHERE c.id = p_competition_id
                  AND (
                      c.club_id IN (SELECT public.my_club_ids())
                      OR c.coach_id = (SELECT auth.uid())
                  )
            ) OR (SELECT public.get_my_role()) = 'ADMIN'
        )
$$;

CREATE OR REPLACE FUNCTION public.can_view_competition_registrations(p_competition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT (SELECT private.caller_is_active())
        AND EXISTS (
            SELECT 1 FROM public.competitions c
            WHERE c.id = p_competition_id
              AND (
                  public.pot_administra_concurs(c.id)
                  OR EXISTS (
                      SELECT 1 FROM public.competition_coaches cc
                      JOIN public.coach_profiles cp ON cp.id = cc.coach_profile_id
                      WHERE cc.competition_id = c.id
                        AND cc.status = 'accepted'
                        AND cp.user_id = (SELECT auth.uid())
                  )
              )
        )
$$;

CREATE OR REPLACE FUNCTION public.respond_to_competition_invitation(p_competition_id UUID, p_accept BOOLEAN)
RETURNS public.competition_coaches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    invitation public.competition_coaches;
BEGIN
    IF (SELECT auth.uid()) IS NULL OR p_accept IS NULL THEN
        RAISE EXCEPTION 'Invitatia necesita un antrenor autentificat si un raspuns'
            USING ERRCODE = '22023';
    END IF;

    IF NOT (SELECT private.caller_is_active()) THEN
        RAISE EXCEPTION 'Contul tau nu este activ'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.competition_coaches AS cc
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
        responded_at = now()
    WHERE cc.competition_id = p_competition_id
      AND cc.status = 'invited'
      AND cc.coach_profile_id IN (
          SELECT cp.id FROM public.coach_profiles AS cp
          WHERE cp.user_id = (SELECT auth.uid())
      )
    RETURNING * INTO invitation;

    IF invitation IS NULL THEN
        RAISE EXCEPTION 'Nu exista o invitatie activa pentru acest concurs'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cash_payments()
RETURNS TABLE(payment_id UUID, enrollment_id UUID, kind TEXT, entity_id UUID, offer_title TEXT,
    participant_name TEXT, is_adult BOOLEAN, sessions INTEGER, amount BIGINT, currency TEXT,
    status TEXT, created_at TIMESTAMPTZ, paid_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := (SELECT auth.uid());
    v_role TEXT;
BEGIN
    SELECT p.role INTO v_role FROM public.profiles p
    WHERE p.id = v_uid AND p.enabled AND p.deleted_at IS NULL;
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

CREATE OR REPLACE FUNCTION public.get_card_payments_month()
RETURNS TABLE(month_start DATE, collected BIGINT, stripe_fee BIGINT, net BIGINT,
    payment_count INTEGER, unsettled_count INTEGER)
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
    SELECT p.role INTO v_role FROM public.profiles p
    WHERE p.id = v_uid AND p.enabled AND p.deleted_at IS NULL;
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

DROP POLICY enrollments_select ON public.enrollments;
CREATE POLICY enrollments_select ON public.enrollments
    FOR SELECT TO authenticated
    USING (
        child_id IN (SELECT public.my_child_ids())
        OR adult_profile_id = (SELECT auth.uid())
        OR (
            (SELECT public.get_my_role()) IS NOT NULL
            AND (
                (kind = 'COURSE' AND entity_id IN (
                    SELECT co.id FROM public.courses co
                    WHERE co.coach_id = (SELECT auth.uid())
                ))
                OR (kind = 'ACTIVITY' AND entity_id IN (
                    SELECT a.id FROM public.activities a
                    WHERE a.coach_id = (SELECT auth.uid())
                ))
                OR (kind = 'COURSE' AND entity_id IN (
                    SELECT c.id FROM public.courses c
                    JOIN public.clubs cl ON c.club_id = cl.id
                    WHERE cl.owner_user_id = (SELECT auth.uid())
                ))
            )
        )
        OR (kind = 'CAMP' AND public.pot_vedea_inscrierile_taberei(entity_id))
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );

DROP POLICY attendance_select ON public.attendance;
CREATE POLICY attendance_select ON public.attendance
    FOR SELECT TO authenticated
    USING (
        child_id IN (SELECT public.my_child_ids())
        OR (
            (SELECT public.get_my_role()) IS NOT NULL
            AND (
                occurrence_id IN (
                    SELECT co.id FROM public.course_occurrences co
                    JOIN public.courses c ON co.course_id = c.id
                    WHERE c.coach_id = (SELECT auth.uid())
                )
                OR occurrence_id IN (
                    SELECT co.id FROM public.course_occurrences co
                    JOIN public.courses c ON co.course_id = c.id
                    JOIN public.clubs cl ON c.club_id = cl.id
                    WHERE cl.owner_user_id = (SELECT auth.uid())
                )
            )
        )
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );
