-- Bug #1342 (step 2): after the frontend that reads the coach's covering
-- clubs through my_covering_club_ids() (00123) is published, signed-in users
-- no longer need public.subscriber_has_access(). Revoking it closes the last
-- way for any account to ask whether a given club or coach has paid. RLS keeps
-- calling it through the SECURITY DEFINER wrappers club_listed/offer_listed
-- and my_covering_club_ids(), which run as their owner; edge functions use
-- service_role.
--
-- Apply only after the production branch contains the coach subscription
-- page that calls my_covering_club_ids(); applying it earlier makes the
-- published coach subscription page fail to load the clubs that cover the
-- coach.

REVOKE EXECUTE ON FUNCTION public.subscriber_has_access(UUID, UUID) FROM anon, authenticated;
