-- Restore EXECUTE on permission functions used by RLS policies.
-- SECURITY DEFINER functions need EXECUTE for the calling role even when referenced in policies.
GRANT EXECUTE ON FUNCTION public.is_ceo(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_perform(uuid, text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_user_hidden(uuid) TO authenticated, anon;