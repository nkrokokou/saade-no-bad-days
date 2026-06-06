
-- 1. Ajout de la valeur 'economat' à l'enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'economat';

-- 2. Table referentiel articles
CREATE TABLE IF NOT EXISTS public.economat_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie TEXT NOT NULL DEFAULT 'DIVERS',
  nom TEXT NOT NULL UNIQUE,
  unite TEXT NOT NULL DEFAULT 'G',
  stock_initial NUMERIC NOT NULL DEFAULT 0,
  prix_unitaire NUMERIC NOT NULL DEFAULT 0,
  stock_min NUMERIC NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.economat_articles TO authenticated;
GRANT ALL ON public.economat_articles TO service_role;
ALTER TABLE public.economat_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perm read economat articles" ON public.economat_articles
  FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'economat', 'read'));
CREATE POLICY "perm insert economat articles" ON public.economat_articles
  FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'economat', 'create'));
CREATE POLICY "perm update economat articles" ON public.economat_articles
  FOR UPDATE TO authenticated USING (can_perform(auth.uid(), 'economat', 'update'));
CREATE POLICY "perm delete economat articles" ON public.economat_articles
  FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'economat', 'delete'));

CREATE TRIGGER trg_economat_articles_updated_at
  BEFORE UPDATE ON public.economat_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Mouvements
CREATE TABLE IF NOT EXISTS public.economat_mouvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.economat_articles(id) ON DELETE CASCADE,
  date_mouvement DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('entree','sortie','perte','inventaire')),
  quantite NUMERIC NOT NULL DEFAULT 0,
  motif TEXT DEFAULT '',
  photo_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_econ_mouv_article ON public.economat_mouvements(article_id);
CREATE INDEX IF NOT EXISTS idx_econ_mouv_date ON public.economat_mouvements(date_mouvement);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.economat_mouvements TO authenticated;
GRANT ALL ON public.economat_mouvements TO service_role;
ALTER TABLE public.economat_mouvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perm read economat mouv" ON public.economat_mouvements
  FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'economat', 'read'));
CREATE POLICY "perm insert economat mouv" ON public.economat_mouvements
  FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'economat', 'create'));
CREATE POLICY "perm update economat mouv" ON public.economat_mouvements
  FOR UPDATE TO authenticated USING (can_perform(auth.uid(), 'economat', 'update'));
CREATE POLICY "perm delete economat mouv" ON public.economat_mouvements
  FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'economat', 'delete'));

-- 4. Vue de stock
CREATE OR REPLACE VIEW public.v_economat_stock AS
SELECT
  a.id, a.categorie, a.nom, a.unite, a.prix_unitaire, a.stock_initial, a.stock_min, a.actif,
  COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END), 0) AS total_entrees,
  COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantite ELSE 0 END), 0) AS total_sorties,
  COALESCE(SUM(CASE WHEN m.type = 'perte'  THEN m.quantite ELSE 0 END), 0) AS total_pertes,
  a.stock_initial
    + COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'perte'  THEN m.quantite ELSE 0 END), 0) AS stock_courant,
  (a.stock_initial
    + COALESCE(SUM(CASE WHEN m.type = 'entree' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'sortie' THEN m.quantite ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type = 'perte'  THEN m.quantite ELSE 0 END), 0)
  ) * a.prix_unitaire AS valeur_stock
FROM public.economat_articles a
LEFT JOIN public.economat_mouvements m ON m.article_id = a.id
GROUP BY a.id;

GRANT SELECT ON public.v_economat_stock TO authenticated;
