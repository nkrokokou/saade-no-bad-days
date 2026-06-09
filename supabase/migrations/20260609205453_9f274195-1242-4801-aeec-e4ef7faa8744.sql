
CREATE TABLE public.fiches_techniques_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produit_id uuid NOT NULL UNIQUE REFERENCES public.produits(id) ON DELETE CASCADE,
  rendement numeric,
  rendement_unite text DEFAULT 'pièces',
  temps_preparation_min integer,
  temps_cuisson_min integer,
  temperature_cuisson integer,
  allergenes text[] DEFAULT '{}',
  etapes text,
  conservation text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiches_techniques_meta TO authenticated;
GRANT ALL ON public.fiches_techniques_meta TO service_role;
ALTER TABLE public.fiches_techniques_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture authentifiée"
  ON public.fiches_techniques_meta FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertion authentifiée"
  ON public.fiches_techniques_meta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Modification authentifiée"
  ON public.fiches_techniques_meta FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Suppression CEO"
  ON public.fiches_techniques_meta FOR DELETE TO authenticated USING (is_ceo(auth.uid()));

CREATE TRIGGER trg_fiches_meta_updated_at
  BEFORE UPDATE ON public.fiches_techniques_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
