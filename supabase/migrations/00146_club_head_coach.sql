-- Feature: the club marks one of its coaches as its founder ("Fondator"),
-- shown on the public club page. At most one per club. Only the club owner
-- (active account) or an admin may change it, through set_club_head_coach;
-- club_coaches still has no UPDATE policy for clients.

ALTER TABLE public.club_coaches
    ADD COLUMN is_head BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX club_coaches_one_head_per_club
    ON public.club_coaches (club_id)
    WHERE is_head;

CREATE OR REPLACE FUNCTION public.set_club_head_coach(p_club_id uuid, p_coach_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT (
        p_club_id IN (SELECT public.my_club_ids())
        OR COALESCE((SELECT public.get_my_role()) = 'ADMIN', false)
    ) THEN
        RAISE EXCEPTION 'Doar clubul propriu' USING ERRCODE = '42501';
    END IF;

    PERFORM 1 FROM public.clubs c WHERE c.id = p_club_id FOR UPDATE;

    IF p_coach_profile_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.club_coaches cc
        WHERE cc.club_id = p_club_id AND cc.coach_profile_id = p_coach_profile_id
    ) THEN
        RAISE EXCEPTION 'Antrenorul nu face parte din club' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.club_coaches
       SET is_head = false
     WHERE club_id = p_club_id
       AND is_head
       AND coach_profile_id IS DISTINCT FROM p_coach_profile_id;

    IF p_coach_profile_id IS NOT NULL THEN
        UPDATE public.club_coaches
           SET is_head = true
         WHERE club_id = p_club_id
           AND coach_profile_id = p_coach_profile_id
           AND NOT is_head;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_club_head_coach(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_club_head_coach(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
