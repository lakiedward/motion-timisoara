ALTER TABLE public.coach_sports
  DROP CONSTRAINT coach_sports_sport_id_fkey,
  ADD CONSTRAINT coach_sports_sport_id_fkey
    FOREIGN KEY (sport_id) REFERENCES public.sports(id) ON DELETE RESTRICT;

ALTER TABLE public.club_sports
  DROP CONSTRAINT club_sports_sport_id_fkey,
  ADD CONSTRAINT club_sports_sport_id_fkey
    FOREIGN KEY (sport_id) REFERENCES public.sports(id) ON DELETE RESTRICT;
