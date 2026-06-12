
-- 1) profiles : SELECT ne révèle plus les comptes cachés
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_non_hidden_or_self_or_ceo"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  COALESCE(is_hidden, false) = false
  OR auth.uid() = id
  OR public.is_ceo(auth.uid())
);

-- 2) profiles : UPDATE par l'utilisateur restreint au nom uniquement
DROP POLICY IF EXISTS "Users can update own profile name only" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_update_self_name_only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND COALESCE(is_hidden, false) IS NOT DISTINCT FROM COALESCE((SELECT p.is_hidden FROM public.profiles p WHERE p.id = auth.uid()), false)
);

-- CEO/developer conservent leur droit d'update via leur policy existante (non touchée).

-- 3) vente_ligne_options : SELECT exige la permission
DROP POLICY IF EXISTS "vente_ligne_options_select" ON public.vente_ligne_options;
DROP POLICY IF EXISTS "Authenticated can read vente_ligne_options" ON public.vente_ligne_options;

CREATE POLICY "vente_ligne_options_select_permission"
ON public.vente_ligne_options
FOR SELECT
TO authenticated
USING (
  public.can_perform(auth.uid(), 'ventes', 'read')
  OR public.can_perform(auth.uid(), 'pos', 'read')
);
