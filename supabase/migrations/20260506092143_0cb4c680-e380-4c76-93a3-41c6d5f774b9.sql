
-- 1. Categories table
CREATE TABLE IF NOT EXISTS public.categories_produits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  ordre INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories_produits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read categories"
  ON public.categories_produits FOR SELECT TO authenticated USING (true);

CREATE POLICY "CEO insert categories"
  ON public.categories_produits FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "CEO update categories"
  ON public.categories_produits FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "CEO delete categories"
  ON public.categories_produits FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE TRIGGER tg_categories_produits_updated
  BEFORE UPDATE ON public.categories_produits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed from existing distinct categorie values
INSERT INTO public.categories_produits (nom, ordre)
SELECT DISTINCT categorie, 0 FROM public.produits
WHERE categorie IS NOT NULL AND categorie <> ''
ON CONFLICT (nom) DO NOTHING;

-- 2. Stock fin compté on cloture (for auto-perte)
ALTER TABLE public.cloture_journaliere
  ADD COLUMN IF NOT EXISTS stock_fin_compte NUMERIC;
