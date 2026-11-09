-- Bug #1381: stripe_account_id și indicatorii Stripe Connect se scriu doar din
-- edge functions cu service_role (stripe-connect, stripe-connect-webhook,
-- register-coach, register-club). Rolurile client (authenticated, anon) au
-- UPDATE/INSERT la nivel de tabel, deci un REVOKE pe coloană nu ar avea efect;
-- folosim un trigger care respinge modificarea de către client.

CREATE OR REPLACE FUNCTION public.guard_stripe_connect_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.stripe_account_id := NULL;
        NEW.stripe_onboarding_complete := false;
        NEW.stripe_charges_enabled := false;
        NEW.stripe_payouts_enabled := false;
    ELSIF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
       OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete
       OR NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled
       OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled THEN
        RAISE EXCEPTION 'Datele contului Stripe se actualizează doar prin Stripe'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_stripe_connect_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS coach_profiles_stripe_connect_guard ON public.coach_profiles;
CREATE TRIGGER coach_profiles_stripe_connect_guard
    BEFORE INSERT OR UPDATE ON public.coach_profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_stripe_connect_columns();

DROP TRIGGER IF EXISTS clubs_stripe_connect_guard ON public.clubs;
CREATE TRIGGER clubs_stripe_connect_guard
    BEFORE INSERT OR UPDATE ON public.clubs
    FOR EACH ROW EXECUTE FUNCTION public.guard_stripe_connect_columns();
