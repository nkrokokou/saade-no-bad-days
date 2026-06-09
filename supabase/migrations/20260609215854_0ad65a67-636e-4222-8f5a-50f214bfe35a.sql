REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM authenticated, anon, public;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO postgres, service_role;