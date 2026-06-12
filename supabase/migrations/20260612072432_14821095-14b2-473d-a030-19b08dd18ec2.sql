DROP POLICY IF EXISTS "Auth insert vente opts" ON public.vente_ligne_options;
CREATE POLICY "Auth insert vente opts" ON public.vente_ligne_options
FOR INSERT TO authenticated
WITH CHECK (can_perform(auth.uid(), 'pos'::text, 'create'::text));

REVOKE EXECUTE ON FUNCTION public.is_user_hidden(uuid) FROM anon, PUBLIC;