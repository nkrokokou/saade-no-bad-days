DROP POLICY IF EXISTS "Insert fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "Update fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "Delete fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "insert_fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "update_fiches_techniques_meta" ON public.fiches_techniques_meta;
DROP POLICY IF EXISTS "delete_fiches_techniques_meta" ON public.fiches_techniques_meta;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='fiches_techniques_meta' AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.fiches_techniques_meta', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "ft_meta_insert" ON public.fiches_techniques_meta
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'fiches_techniques', 'create'));

CREATE POLICY "ft_meta_update" ON public.fiches_techniques_meta
  FOR UPDATE TO authenticated
  USING (public.can_perform(auth.uid(), 'fiches_techniques', 'update'))
  WITH CHECK (public.can_perform(auth.uid(), 'fiches_techniques', 'update'));

CREATE POLICY "ft_meta_delete" ON public.fiches_techniques_meta
  FOR DELETE TO authenticated
  USING (public.can_perform(auth.uid(), 'fiches_techniques', 'delete'));