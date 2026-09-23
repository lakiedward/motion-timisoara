CREATE FUNCTION public.can_edit_competition_podium(p_competition_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.competitions c
        WHERE c.id = p_competition_id
          AND c.end_at <= now()
          AND public.can_view_competition_registrations(c.id)
    )
$$;

REVOKE ALL ON FUNCTION public.can_edit_competition_podium(UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_competition_podium(UUID)
    TO authenticated;

CREATE TABLE public.competition_podium_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
    CONSTRAINT competition_podium_publications_category_fk FOREIGN KEY (category_id, competition_id)
        REFERENCES public.competition_age_categories (id, competition_id) ON DELETE RESTRICT,
    CONSTRAINT competition_podium_publications_category_key UNIQUE (category_id)
);

CREATE INDEX competition_podium_publications_competition_idx
    ON public.competition_podium_publications (competition_id, published_at);

ALTER TABLE public.competition_podium_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_podium_publications FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, competition_id, category_id, published_at)
    ON public.competition_podium_publications TO anon;
GRANT SELECT ON public.competition_podium_publications TO authenticated;
GRANT INSERT (competition_id, category_id)
    ON public.competition_podium_publications TO authenticated;

CREATE POLICY competition_podium_publications_select ON public.competition_podium_publications
    FOR SELECT TO anon, authenticated USING (TRUE);

CREATE TABLE public.competition_podium_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL,
    registration_id UUID NOT NULL,
    place INTEGER NOT NULL CHECK (place BETWEEN 1 AND 3),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT competition_podium_results_category_fk FOREIGN KEY (category_id, competition_id)
        REFERENCES public.competition_age_categories (id, competition_id) ON DELETE RESTRICT,
    CONSTRAINT competition_podium_results_registration_fk FOREIGN KEY (registration_id, competition_id, category_id)
        REFERENCES public.competition_registrations (id, competition_id, category_id) ON DELETE CASCADE,
    CONSTRAINT competition_podium_results_place_key UNIQUE (category_id, place)
        DEFERRABLE INITIALLY IMMEDIATE,
    CONSTRAINT competition_podium_results_candidate_key UNIQUE (category_id, registration_id)
        DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX competition_podium_results_competition_idx
    ON public.competition_podium_results (competition_id, category_id, place);

CREATE FUNCTION public.guard_competition_podium_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.competition_registrations registration
        JOIN public.enrollments enrollment ON enrollment.id = registration.enrollment_id
        JOIN public.competitions competition ON competition.id = registration.competition_id
        WHERE registration.id = NEW.registration_id
          AND registration.competition_id = NEW.competition_id
          AND registration.category_id = NEW.category_id
          AND enrollment.status = 'ACTIVE'
          AND competition.end_at <= now()
    ) THEN
        RAISE EXCEPTION 'Podiumul accepta doar participanti inscrisi dupa incheierea concursului'
            USING ERRCODE = '23514';
    END IF;

    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    RETURN NEW;
END;
$$;

CREATE TRIGGER competition_podium_results_guard
    BEFORE INSERT OR UPDATE ON public.competition_podium_results
    FOR EACH ROW EXECUTE FUNCTION public.guard_competition_podium_result();

ALTER TABLE public.competition_podium_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_podium_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.competition_podium_results TO authenticated;
GRANT INSERT (competition_id, category_id, registration_id, place)
    ON public.competition_podium_results TO authenticated;
GRANT UPDATE (registration_id, place) ON public.competition_podium_results TO authenticated;
GRANT DELETE ON public.competition_podium_results TO authenticated;

CREATE POLICY competition_podium_results_public_select ON public.competition_podium_results
    FOR SELECT TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.competition_podium_publications publication
            WHERE publication.category_id = competition_podium_results.category_id
              AND publication.competition_id = competition_podium_results.competition_id
        )
    );

CREATE POLICY competition_podium_results_staff_select ON public.competition_podium_results
    FOR SELECT TO authenticated
    USING (public.can_view_competition_registrations(competition_id));

CREATE POLICY competition_podium_results_insert ON public.competition_podium_results
    FOR INSERT TO authenticated
    WITH CHECK (public.can_edit_competition_podium(competition_id));

CREATE POLICY competition_podium_results_update ON public.competition_podium_results
    FOR UPDATE TO authenticated
    USING (public.can_edit_competition_podium(competition_id))
    WITH CHECK (public.can_edit_competition_podium(competition_id));

CREATE POLICY competition_podium_results_delete ON public.competition_podium_results
    FOR DELETE TO authenticated
    USING (public.can_edit_competition_podium(competition_id));

CREATE POLICY competition_podium_publications_insert ON public.competition_podium_publications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.pot_administra_concurs(competition_id)
        AND EXISTS (
            SELECT 1 FROM public.competitions competition
            WHERE competition.id = competition_podium_publications.competition_id
              AND competition.end_at <= now()
        )
        AND EXISTS (
            SELECT 1 FROM public.competition_podium_results result
            WHERE result.competition_id = competition_podium_publications.competition_id
              AND result.category_id = competition_podium_publications.category_id
        )
    );

CREATE FUNCTION public.get_published_competition_podium(p_competition_id UUID)
RETURNS TABLE (
    category_id UUID,
    place INTEGER,
    participant_name TEXT,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT result.category_id, result.place, COALESCE(child.name, adult.name),
        publication.published_at, result.updated_at
    FROM public.competition_podium_results result
    JOIN public.competition_podium_publications publication
      ON publication.category_id = result.category_id
     AND publication.competition_id = result.competition_id
    JOIN public.competition_registrations registration
      ON registration.id = result.registration_id
    JOIN public.enrollments enrollment
      ON enrollment.id = registration.enrollment_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    WHERE result.competition_id = p_competition_id
      AND enrollment.status = 'ACTIVE'
    ORDER BY result.category_id, result.place
$$;

REVOKE ALL ON FUNCTION public.get_published_competition_podium(UUID)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_competition_podium(UUID)
    TO anon, authenticated;

CREATE FUNCTION public.get_competition_podium_candidates(
    p_competition_id UUID,
    p_category_id UUID
)
RETURNS TABLE (
    registration_id UUID,
    participant_name TEXT,
    age_at_registration INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF public.can_view_competition_registrations(p_competition_id) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Nu ai acces la înscrierile acestui concurs'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT registration.id, COALESCE(child.name, adult.name), registration.age_at_registration
    FROM public.competition_registrations registration
    JOIN public.enrollments enrollment ON enrollment.id = registration.enrollment_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    WHERE registration.competition_id = p_competition_id
      AND registration.category_id = p_category_id
      AND enrollment.status = 'ACTIVE'
    ORDER BY COALESCE(child.name, adult.name), registration.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_competition_podium_candidates(UUID, UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_competition_podium_candidates(UUID, UUID)
    TO authenticated;

CREATE FUNCTION public.get_competition_cash_payments(p_competition_id UUID)
RETURNS TABLE (
    payment_id UUID,
    enrollment_id UUID,
    participant_name TEXT,
    category_name TEXT,
    amount BIGINT,
    currency TEXT,
    status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF public.pot_administra_concurs(p_competition_id) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Nu ai acces la plățile acestui concurs'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT payment.id, enrollment.id, COALESCE(child.name, adult.name),
        registration.category_name_snapshot, payment.amount,
        payment.currency, payment.status
    FROM public.competition_registrations registration
    JOIN public.enrollments enrollment ON enrollment.id = registration.enrollment_id
    LEFT JOIN public.children child ON child.id = enrollment.child_id
    LEFT JOIN public.profiles adult ON adult.id = enrollment.adult_profile_id
    JOIN public.payments payment ON payment.enrollment_id = enrollment.id
    WHERE registration.competition_id = p_competition_id
      AND payment.method = 'CASH'
    ORDER BY registration.registered_at, COALESCE(child.name, adult.name), payment.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_competition_cash_payments(UUID)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_competition_cash_payments(UUID)
    TO authenticated;
