
REVOKE EXECUTE ON FUNCTION public.generer_alertes_systeme() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generer_alertes_systeme() TO service_role, postgres;
