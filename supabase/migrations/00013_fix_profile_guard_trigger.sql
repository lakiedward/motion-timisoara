-- ============================================================
-- Fix: the profile privilege-guard trigger from 00011 was created
-- SECURITY DEFINER, so `current_user` inside it resolved to the function owner
-- (postgres) — which is in the exempt list — and the guard never fired.
-- Recreate it as SECURITY INVOKER so `current_user` reflects the real caller
-- (authenticated / service_role), letting the guard actually block non-admins.
-- get_my_role() remains SECURITY DEFINER and resolves the caller's app role.
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.enabled IS DISTINCT FROM OLD.enabled)
     AND public.get_my_role() IS DISTINCT FROM 'ADMIN'
     AND current_user NOT IN ('service_role', 'supabase_admin', 'supabase_auth_admin', 'postgres', 'supabase_storage_admin') THEN
    RAISE EXCEPTION 'Only administrators may change role or enabled';
  END IF;
  RETURN NEW;
END $$;
