
-- 1. Fix evidence-photos SELECT to owner-only (CEO bypass)
DROP POLICY IF EXISTS "Authenticated can view evidence photos" ON storage.objects;

CREATE POLICY "Users view own evidence photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'evidence-photos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_ceo(auth.uid())
    )
  );

-- 2. Allow authenticated users to read all profiles (needed for staff name/role display)
CREATE POLICY "Authenticated can read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- 3. Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated.
-- They are used inside RLS policies (run with definer privileges regardless) and
-- should not be exposed via PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_ceo(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_perform(uuid, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_produit_prix_cout() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_credit_restant() FROM anon, authenticated, public;
