-- ============================================================
-- Security hardening: pin search_path on SECURITY DEFINER helpers
-- Addresses advisor lint 0011_function_search_path_mutable.
-- All function bodies use fully schema-qualified names (public.*, auth.uid()),
-- so an empty search_path is safe.
-- ============================================================
ALTER FUNCTION public.get_my_role() SET search_path = '';
ALTER FUNCTION public.get_my_club_id() SET search_path = '';
ALTER FUNCTION public.get_my_coach_profile_id() SET search_path = '';
ALTER FUNCTION public.is_my_child(uuid) SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.custom_access_token_hook(jsonb) SET search_path = '';
