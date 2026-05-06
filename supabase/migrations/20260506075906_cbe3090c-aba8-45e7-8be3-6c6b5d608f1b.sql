
ALTER TABLE public.produits
  ADD COLUMN IF NOT EXISTS sous_categorie text,
  ADD COLUMN IF NOT EXISTS prix_cout numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Permissions catalogue : CEO bypass déjà géré par can_perform.
-- Seed default module_permissions for 'catalogue' module so non-CEO can read.
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
SELECT r::public.app_role, 'catalogue', true, false, false, false
FROM unnest(ARRAY['labo_patisserie','labo_viennoiserie','cuisine_salee','salle']) AS r
ON CONFLICT DO NOTHING;

-- Update produits RLS to use 'catalogue' module
DROP POLICY IF EXISTS "perm insert produits" ON public.produits;
DROP POLICY IF EXISTS "perm update produits" ON public.produits;
DROP POLICY IF EXISTS "perm delete produits" ON public.produits;

CREATE POLICY "perm insert produits" ON public.produits
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'catalogue', 'create'));

CREATE POLICY "perm update produits" ON public.produits
  FOR UPDATE TO authenticated
  USING (public.can_perform(auth.uid(), 'catalogue', 'update'));

CREATE POLICY "perm delete produits" ON public.produits
  FOR DELETE TO authenticated
  USING (public.can_perform(auth.uid(), 'catalogue', 'delete'));
