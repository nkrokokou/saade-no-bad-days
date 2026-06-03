REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM anon;