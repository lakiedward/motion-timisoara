CREATE OR REPLACE FUNCTION public.audience_club_id(p_kind TEXT, p_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p_kind
        WHEN 'COURSE' THEN (SELECT c.club_id FROM public.courses c WHERE c.id = p_id)
        WHEN 'ACTIVITY' THEN (SELECT a.club_id FROM public.activities a WHERE a.id = p_id)
        WHEN 'CAMP' THEN (SELECT c.club_id FROM public.camps c WHERE c.id = p_id)
        ELSE NULL
    END
$$;

COMMENT ON FUNCTION public.audience_club_id(TEXT, UUID) IS
    'Clubul care deține cursul, activitatea sau tabăra dată. NULL dacă entitatea nu există, nu are club sau tipul nu are apartenență exprimabilă.';

ALTER TABLE public.club_announcements
    DROP CONSTRAINT IF EXISTS club_announcements_audience_kind_ck;
ALTER TABLE public.club_announcements
    ADD CONSTRAINT club_announcements_audience_kind_ck
    CHECK (audience_kind IN ('CLUB', 'COURSE', 'ACTIVITY', 'CAMP'));
