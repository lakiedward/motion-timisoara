-- Organizatorii nu mai citesc rândurile din `payments` ale părinților.
--
-- Bug TT #1367 (review RLS concursuri, To-Do #312). `payments_select` din 00068
-- avea ramuri pentru antrenorul cursului/activității și pentru proprietarul
-- clubului cursului, iar `payments_competition_staff_select` din 00072 dădea
-- organizatorului concursului același acces. `authenticated` are SELECT pe toate
-- coloanele, deci organizatorul citea numele, emailul și adresa de facturare ale
-- părintelui, cardul (brand, ultimele 4 cifre), `client_secret`, ID-urile Stripe
-- și linkul facturii. Pe `profiles` organizatorul nu vede email/telefon, așa că
-- aici datele de contact scăpau pe altă cale.
--
-- Aplicația nu citește `payments` ca organizator: părintele își citește plățile
-- în `src/api/account.ts` și `src/api/payments/enrollments.ts`, iar organizatorii
-- folosesc funcțiile SECURITY DEFINER `get_cash_payments()`,
-- `get_competition_cash_payments()` și `get_card_payments_month()`, care întorc
-- doar coloanele de care are nevoie ecranul. Edge functions citesc ca
-- service_role. Rămân în `payments_select` doar părintele copilului, adultul
-- înscris și adminul activ (`get_my_role()` din 00129).
--
-- Efect secundar: ramura de antrenor din `invoices_select` caută plăți prin
-- `payments`, deci antrenorul nu mai vede facturile. Tabela are 0 rânduri și
-- aplicația nu o citește; o facturare pentru antrenor va avea nevoie de propria
-- funcție.
--
-- Migrația se oprește dacă politicile live nu mai sunt cele verificate pe
-- 2026-11-06, în loc să calce o schimbare făcută între timp.

DO $$
DECLARE
    v_policies TEXT[];
    v_select TEXT;
BEGIN
    SELECT array_agg(policyname::TEXT ORDER BY policyname) INTO v_policies
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payments';

    SELECT qual INTO v_select
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_select';

    IF v_policies IS DISTINCT FROM ARRAY[
        'payments_competition_staff_select', 'payments_delete', 'payments_insert',
        'payments_select', 'payments_update']
       OR v_select IS NULL
       OR v_select NOT LIKE '%adult_profile_id%'
       OR v_select NOT LIKE '%owner_user_id%' THEN
        RAISE EXCEPTION 'Politicile pe payments nu mai sunt cele din 00068/00072 (%). Recitește-le înainte de 00131.',
            v_policies;
    END IF;
END $$;

DROP POLICY payments_competition_staff_select ON public.payments;

DROP POLICY payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments
    FOR SELECT TO authenticated
    USING (
        enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            JOIN public.children c ON e.child_id = c.id
            WHERE c.parent_id = (SELECT auth.uid())
        )
        OR enrollment_id IN (
            SELECT e.id FROM public.enrollments e
            WHERE e.adult_profile_id = (SELECT auth.uid())
        )
        OR (SELECT public.get_my_role()) = 'ADMIN'
    );
