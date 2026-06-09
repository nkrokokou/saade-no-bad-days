GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO authenticated;