-- Add prix_vente to produits
ALTER TABLE public.produits ADD COLUMN prix_vente numeric NOT NULL DEFAULT 0;

-- Create fiches_techniques table (recipes: MP → product)
CREATE TABLE public.fiches_techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL REFERENCES public.produits(id) ON DELETE CASCADE,
  matiere_premiere text NOT NULL,
  quantite_mp numeric NOT NULL DEFAULT 0,
  unite_mp text NOT NULL DEFAULT 'kg',
  cout_unitaire_mp numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.fiches_techniques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read fiches" ON public.fiches_techniques FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert fiches" ON public.fiches_techniques FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update fiches" ON public.fiches_techniques FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete fiches" ON public.fiches_techniques FOR DELETE TO authenticated USING (true);

-- Allow authenticated to insert/update produits (for prix_vente management)
CREATE POLICY "Authenticated can insert produits" ON public.produits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update produits" ON public.produits FOR UPDATE TO authenticated USING (true);