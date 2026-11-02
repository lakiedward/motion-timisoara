ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user UUID := auth.uid();
    v_role TEXT;
    v_children UUID[];
    v_enrollments UUID[];
    v_cancelled INTEGER;
    v_retained BOOLEAN;
    v_email TEXT;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Autentificarea este necesară' USING ERRCODE = '42501';
    END IF;
    SELECT role INTO v_role FROM public.profiles
        WHERE id = v_user AND deleted_at IS NULL FOR UPDATE;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Contul nu mai există' USING ERRCODE = 'P0002', HINT = 'account_already_deleted';
    END IF;
    IF v_role <> 'PARENT' THEN
        RAISE EXCEPTION 'Doar conturile de părinte se pot șterge din aplicație'
            USING ERRCODE = '42501', HINT = 'account_deletion_parent_only';
    END IF;

    SELECT COALESCE(array_agg(id), '{}') INTO v_children
        FROM public.children WHERE parent_id = v_user;
    SELECT COALESCE(array_agg(id), '{}') INTO v_enrollments
        FROM public.enrollments WHERE child_id = ANY (v_children) OR adult_profile_id = v_user;

    UPDATE public.enrollments SET status = 'CANCELLED'
        WHERE id = ANY (v_enrollments) AND status <> 'CANCELLED';
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
    UPDATE public.payments SET status = 'FAILED', updated_at = now()
        WHERE enrollment_id = ANY (v_enrollments) AND status = 'PENDING';
    UPDATE public.monthly_payments SET status = 'FAILED'
        WHERE enrollment_id = ANY (v_enrollments) AND status = 'PENDING';

    DELETE FROM public.course_ratings WHERE parent_id = v_user;
    DELETE FROM public.coach_ratings WHERE parent_id = v_user;
    DELETE FROM public.parent_live_location_consents WHERE parent_id = v_user;
    DELETE FROM public.user_recent_locations WHERE user_id = v_user;
    DELETE FROM public.user_announcement_views WHERE user_id = v_user;
    DELETE FROM public.push_devices WHERE user_id = v_user;
    DELETE FROM public.push_preferences WHERE user_id = v_user;

    v_retained := EXISTS (SELECT FROM public.payments
            WHERE enrollment_id = ANY (v_enrollments) AND status IN ('SUCCEEDED', 'REFUNDED', 'PARTIAL'))
        OR EXISTS (SELECT FROM public.monthly_payments
            WHERE enrollment_id = ANY (v_enrollments) AND status IN ('SUCCEEDED', 'REFUNDED', 'PARTIAL'))
        OR EXISTS (SELECT FROM public.checkout_acceptances WHERE user_id = v_user)
        OR EXISTS (SELECT FROM public.attendance WHERE child_id = ANY (v_children))
        OR EXISTS (SELECT FROM public.activity_attendance WHERE child_id = ANY (v_children))
        OR EXISTS (SELECT FROM public.attendance_accounting WHERE child_id = ANY (v_children))
        OR EXISTS (SELECT FROM public.camp_participation WHERE enrollment_id = ANY (v_enrollments));

    IF NOT v_retained THEN
        DELETE FROM auth.users WHERE id = v_user;
        RETURN jsonb_build_object('mode', 'deleted', 'cancelledEnrollments', v_cancelled);
    END IF;

    v_email := v_user::TEXT || '@cont-sters.invalid';
    UPDATE public.children SET
        name = 'Copil șters',
        birth_date = date_trunc('year', birth_date)::DATE,
        level = NULL,
        allergies = NULL,
        emergency_contact_name = NULL,
        emergency_phone = NULL,
        gdpr_consent_at = NULL,
        secondary_contact_name = NULL,
        secondary_phone = NULL,
        tshirt_size = NULL,
        photo_storage_path = NULL,
        qr_token = replace(gen_random_uuid()::TEXT, '-', ''),
        photo_consent = NULL,
        pickup_persons = NULL,
        swim_level = NULL,
        medical_notes = NULL,
        dietary_restrictions = NULL
        WHERE id = ANY (v_children);
    UPDATE public.attendance SET note = NULL WHERE child_id = ANY (v_children) AND note IS NOT NULL;
    UPDATE public.competition_registrations SET adult_birth_date = NULL WHERE adult_profile_id = v_user;
    UPDATE public.payments SET
        billing_name = NULL, billing_email = NULL, billing_address_line1 = NULL,
        billing_city = NULL, billing_postal_code = NULL, billing_country = NULL, client_secret = NULL
        WHERE enrollment_id = ANY (v_enrollments) AND status NOT IN ('SUCCEEDED', 'REFUNDED', 'PARTIAL');
    UPDATE public.profiles SET
        name = 'Cont șters',
        email = v_email,
        phone = NULL,
        avatar_url = NULL,
        oauth_provider = NULL,
        oauth_provider_id = NULL,
        enabled = false,
        deleted_at = now()
        WHERE id = v_user;

    DELETE FROM auth.identities WHERE user_id = v_user;
    DELETE FROM auth.sessions WHERE user_id = v_user;
    DELETE FROM auth.refresh_tokens WHERE user_id = v_user::TEXT;
    UPDATE auth.users SET
        email = v_email,
        encrypted_password = '',
        phone = NULL,
        raw_user_meta_data = '{}'::JSONB,
        banned_until = now() + INTERVAL '100 years',
        updated_at = now()
        WHERE id = v_user;

    RETURN jsonb_build_object('mode', 'anonymized', 'cancelledEnrollments', v_cancelled);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
