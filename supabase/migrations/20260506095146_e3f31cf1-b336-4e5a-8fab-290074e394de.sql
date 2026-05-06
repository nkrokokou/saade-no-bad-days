
-- 1. Add poste_preparation to produits
ALTER TABLE public.produits
  ADD COLUMN IF NOT EXISTS poste_preparation text NOT NULL DEFAULT 'salle';

-- 2. Tables restaurant
CREATE TABLE IF NOT EXISTS public.tables_restaurant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  zone text,
  places integer NOT NULL DEFAULT 2,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tables_restaurant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read tables" ON public.tables_restaurant
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "CEO manage tables insert" ON public.tables_restaurant
  FOR INSERT TO authenticated WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "CEO manage tables update" ON public.tables_restaurant
  FOR UPDATE TO authenticated USING (public.is_ceo(auth.uid())) WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "CEO manage tables delete" ON public.tables_restaurant
  FOR DELETE TO authenticated USING (public.is_ceo(auth.uid()));

CREATE TRIGGER trg_tables_updated_at BEFORE UPDATE ON public.tables_restaurant
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Ventes: table_id + serveur_id (pour service à table)
ALTER TABLE public.ventes
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.tables_restaurant(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS serveur_id uuid;

CREATE INDEX IF NOT EXISTS idx_ventes_statut_table ON public.ventes(statut, table_id);

-- 4. Seed quelques tables par défaut
INSERT INTO public.tables_restaurant (numero, zone, places) VALUES
  ('1', 'Salle', 2),('2', 'Salle', 2),('3', 'Salle', 4),('4', 'Salle', 4),
  ('5', 'Terrasse', 2),('6', 'Terrasse', 4),('Comptoir', 'Comptoir', 1)
ON CONFLICT (numero) DO NOTHING;
