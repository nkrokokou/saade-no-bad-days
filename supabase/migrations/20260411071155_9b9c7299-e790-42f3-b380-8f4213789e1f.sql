
-- Table Clôture journalière & Invendus -50%
CREATE TABLE public.cloture_journaliere (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_cloture DATE NOT NULL,
  produit_id UUID NOT NULL REFERENCES public.produits(id),
  qte_vendue NUMERIC NOT NULL DEFAULT 0,
  qte_invendu NUMERIC NOT NULL DEFAULT 0,
  prix_invendu_50 NUMERIC NOT NULL DEFAULT 0,
  qte_perte NUMERIC NOT NULL DEFAULT 0,
  qte_degustation NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cloture_journaliere ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cloture" ON public.cloture_journaliere FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cloture" ON public.cloture_journaliere FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update cloture" ON public.cloture_journaliere FOR UPDATE TO authenticated USING (true);

-- Table Dégustations
CREATE TABLE public.degustations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_degustation DATE NOT NULL,
  produit_id UUID NOT NULL REFERENCES public.produits(id),
  quantite NUMERIC NOT NULL DEFAULT 0,
  motif TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.degustations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read degustations" ON public.degustations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert degustations" ON public.degustations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update degustations" ON public.degustations FOR UPDATE TO authenticated USING (true);
