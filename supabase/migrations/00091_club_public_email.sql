-- ============================================================
-- Emailul public al clubului, doar cu acordul clubului.
--
-- Bug #1186: politica `clubs_select` lasă anon să citească toate cluburile,
-- iar grantul pe coloane din 00012 îi dă și `email`. Pagina clubului ascunde
-- emailul fără `public_email_consent`, dar API-ul REST îl întorcea oricum.
--
-- `public_email` e o coloană generată: emailul când clubul și-a dat acordul,
-- altfel NULL. Pagina publică citește doar această coloană. Retragerea lui
-- `email` de la anon vine separat, în 00092, după ce frontendul nou e live,
-- ca pagina de cluburi să nu ceară o coloană interzisă între timp.
-- ============================================================

ALTER TABLE public.clubs
    ADD COLUMN public_email text
    GENERATED ALWAYS AS (CASE WHEN public_email_consent THEN email END) STORED;

GRANT SELECT (public_email) ON public.clubs TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
