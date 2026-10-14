-- ============================================================
-- Conturile logate nu mai citesc emailul brut al altor cluburi.
--
-- Urmare la #1186: după 00092, `authenticated` păstra SELECT pe
-- `clubs.email`, deci orice părinte, antrenor sau alt club citea prin REST
-- emailurile cluburilor fără `public_email_consent`.
--
-- Se aplică după 00093 și după ce frontendul care citește lista de admin
-- prin `admin_clubs()` e live. Rămân căile legitime:
-- - proprietarul își citește rândul întreg prin `my_club()` (SECURITY DEFINER);
-- - adminul citește lista prin `admin_clubs()`;
-- - toată lumea vede emailul consimțit prin `public_email`;
-- - funcțiile edge (stripe-connect, register-club) folosesc cheia de serviciu.
-- Tabelul nu mai are grant SELECT la nivel de tabel pentru `authenticated`
-- (00035), deci revocarea pe coloană are efect. UPDATE pe `email` rămâne:
-- clubul își salvează profilul fără să citească coloana înapoi.
-- ============================================================

REVOKE SELECT (email) ON public.clubs FROM authenticated;

NOTIFY pgrst, 'reload schema';
