
-- Table achats matières premières
CREATE TABLE public.achats_mp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_achat DATE NOT NULL,
  fournisseur TEXT NOT NULL DEFAULT '',
  produit TEXT NOT NULL,
  quantite NUMERIC NOT NULL DEFAULT 0,
  unite TEXT DEFAULT 'kg',
  prix_unitaire NUMERIC NOT NULL DEFAULT 0,
  prix_total NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.achats_mp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read achats" ON public.achats_mp FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert achats" ON public.achats_mp FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update achats" ON public.achats_mp FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete achats" ON public.achats_mp FOR DELETE TO authenticated USING (true);

-- Table mouvements stock tampon (entrées/sorties)
CREATE TABLE public.mouvements_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_mouvement DATE NOT NULL,
  produit_id UUID NOT NULL REFERENCES public.produits(id),
  type TEXT NOT NULL DEFAULT 'entree', -- 'entree' or 'sortie'
  quantite NUMERIC NOT NULL DEFAULT 0,
  motif TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mouvements_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mouvements" ON public.mouvements_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert mouvements" ON public.mouvements_stock FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update mouvements" ON public.mouvements_stock FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete mouvements" ON public.mouvements_stock FOR DELETE TO authenticated USING (true);

-- Ajout colonnes flux salle à clôture journalière
ALTER TABLE public.cloture_journaliere ADD COLUMN IF NOT EXISTS stock_ouverture NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.cloture_journaliere ADD COLUMN IF NOT EXISTS qte_recue NUMERIC NOT NULL DEFAULT 0;

-- Enable realtime pour mouvements
ALTER PUBLICATION supabase_realtime ADD TABLE public.mouvements_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.achats_mp;
