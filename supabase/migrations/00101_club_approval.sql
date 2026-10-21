-- ============================================================
-- Aprobarea clubului de către administrator (funcționalitatea #451).
--
-- /signup promite pe cardul Club „Necesită aprobarea unui administrator”,
-- dar `register-club` crea clubul vizibil imediat. De acum un club nou
-- rămâne în așteptare (`approved_at` NULL) până îl aprobă un ADMIN prin
-- `approve_club()`:
--   * `clubs_select` îl ascunde de anon și de alte conturi; îl văd doar
--     proprietarul și administratorii;
--   * nu poate crea cursuri, tabere, activități sau concursuri, deci nimic
--     de-al lui nu ajunge pe paginile publice;
--   * nimeni în afară de ADMIN (sau service_role, fără utilizator) nu poate
--     scrie `approved_at` / `approved_by`.
--
-- Cluburile existente sunt considerate aprobate de la `created_at`, deci
-- nimic din ce e azi public nu dispare. `register-club` nu se schimbă:
-- inserează fără `approved_at`, adică în așteptare.
-- ============================================================

ALTER TABLE public.clubs
    ADD COLUMN approved_at TIMESTAMPTZ,
    ADD COLUMN approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.clubs SET approved_at = created_at WHERE approved_at IS NULL;

-- --- cine vede un club ---------------------------------------------------
DROP POLICY IF EXISTS "clubs_select" ON public.clubs;
CREATE POLICY "clubs_select_anon" ON public.clubs
  FOR SELECT TO anon
  USING (approved_at IS NOT NULL);
CREATE POLICY "clubs_select" ON public.clubs
  FOR SELECT TO authenticated
  USING (
    approved_at IS NOT NULL
    OR owner_user_id = (select auth.uid())
    OR (select public.get_my_role()) = 'ADMIN'
  );

GRANT SELECT (approved_at) ON public.clubs TO authenticated;

-- --- cine poate scrie aprobarea ------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_club_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT auth.uid()) IS NULL
       OR (SELECT public.get_my_role()) = 'ADMIN' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.approved_at := NULL;
        NEW.approved_by := NULL;
    ELSIF NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
        RAISE EXCEPTION 'Doar un administrator poate aproba un club'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_club_approval() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER clubs_approval_guard
    BEFORE INSERT OR UPDATE ON public.clubs
    FOR EACH ROW EXECUTE FUNCTION public.guard_club_approval();

-- --- un club în așteptare nu publică nimic -------------------------------
CREATE OR REPLACE FUNCTION public.guard_pending_club_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.club_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.club_id IS DISTINCT FROM OLD.club_id)
       AND EXISTS (
           SELECT 1 FROM public.clubs c
           WHERE c.id = NEW.club_id AND c.approved_at IS NULL
       ) THEN
        RAISE EXCEPTION 'Clubul așteaptă aprobarea unui administrator'
            USING ERRCODE = '42501', HINT = 'club_pending_approval';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_pending_club_content() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER courses_pending_club_guard
    BEFORE INSERT OR UPDATE OF club_id ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.guard_pending_club_content();
CREATE TRIGGER camps_pending_club_guard
    BEFORE INSERT OR UPDATE OF club_id ON public.camps
    FOR EACH ROW EXECUTE FUNCTION public.guard_pending_club_content();
CREATE TRIGGER activities_pending_club_guard
    BEFORE INSERT OR UPDATE OF club_id ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.guard_pending_club_content();
CREATE TRIGGER competitions_pending_club_guard
    BEFORE INSERT OR UPDATE OF club_id ON public.competitions
    FOR EACH ROW EXECUTE FUNCTION public.guard_pending_club_content();

-- --- aprobarea -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_club(p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT public.get_my_role()) IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'Doar administratorii pot aproba cluburi'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.clubs
       SET approved_at = now(), approved_by = (SELECT auth.uid())
     WHERE id = p_club_id AND approved_at IS NULL;

    IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id) THEN
        RAISE EXCEPTION 'Clubul nu există' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_club(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_club(uuid) TO authenticated;

-- --- lista administratorului, cu starea aprobării ------------------------
DROP FUNCTION IF EXISTS public.admin_clubs();
CREATE FUNCTION public.admin_clubs()
RETURNS TABLE (
    id uuid,
    name text,
    city text,
    email text,
    approved_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF (SELECT public.get_my_role()) IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION 'Doar administratorii pot citi lista de cluburi'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
        SELECT c.id, c.name, c.city, c.email, c.approved_at
        FROM public.clubs c
        ORDER BY c.name ASC, c.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clubs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clubs() TO authenticated;

NOTIFY pgrst, 'reload schema';
