
-- 1. Fix produits permissive policies
DROP POLICY IF EXISTS "Authenticated can insert produits" ON public.produits;
DROP POLICY IF EXISTS "Authenticated can update produits" ON public.produits;

CREATE POLICY "perm insert produits" ON public.produits
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'fiches_techniques', 'create'));

CREATE POLICY "perm update produits" ON public.produits
  FOR UPDATE TO authenticated
  USING (public.can_perform(auth.uid(), 'fiches_techniques', 'update'));

CREATE POLICY "perm delete produits" ON public.produits
  FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

-- 2. Make evidence-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'evidence-photos';

DROP POLICY IF EXISTS "Public can view evidence photos" ON storage.objects;

CREATE POLICY "Authenticated can view evidence photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'evidence-photos');

-- 3. Prevent users from changing their own role via profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile name only"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "CEO can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()))
  WITH CHECK (public.is_ceo(auth.uid()));
