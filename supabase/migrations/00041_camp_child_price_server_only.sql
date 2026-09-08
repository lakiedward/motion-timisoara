REVOKE ALL ON FUNCTION public.pret_tabara_pentru_copil(UUID, UUID)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pret_tabara_pentru_copil(UUID, UUID)
    TO service_role;
