-- ============================================================
-- Helper Functions & Auth Triggers
-- ============================================================

-- =====================
-- HELPER: Get current user's app role
-- =====================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================
-- HELPER: Get current user's club_id (for CLUB role)
-- =====================
CREATE OR REPLACE FUNCTION public.get_my_club_id()
RETURNS UUID AS $$
    SELECT id FROM public.clubs WHERE owner_user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================
-- HELPER: Get current user's coach_profile_id (for COACH role)
-- =====================
CREATE OR REPLACE FUNCTION public.get_my_coach_profile_id()
RETURNS UUID AS $$
    SELECT id FROM public.coach_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================
-- HELPER: Check if child belongs to current parent
-- =====================
CREATE OR REPLACE FUNCTION public.is_my_child(child_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS(
        SELECT 1 FROM public.children WHERE id = child_uuid AND parent_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =====================
-- TRIGGER: Auto-create profile on auth.users insert
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'PARENT'),
        now()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- AUTH HOOK: Inject app_role into JWT claims
-- Enable in Supabase Dashboard > Authentication > Hooks
-- =====================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = (event->>'user_id')::uuid;
    IF user_role IS NOT NULL THEN
        event := jsonb_set(event, '{claims,app_role}', to_jsonb(user_role));
    END IF;
    RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions for the auth hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.profiles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
