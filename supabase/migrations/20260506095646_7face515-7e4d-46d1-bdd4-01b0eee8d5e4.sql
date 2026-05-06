
CREATE TABLE IF NOT EXISTS public.matieres_premieres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  marque text,
  fournisseur text,
  colisage numeric NOT NULL DEFAULT 1,
  unite text NOT NULL DEFAULT 'G',
  prix_achat numeric NOT NULL DEFAULT 0,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  notes text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nom, marque, fournisseur)
);

ALTER TABLE public.matieres_premieres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read MP" ON public.matieres_premieres
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "perm insert MP" ON public.matieres_premieres
  FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(), 'catalogue', 'create'));
CREATE POLICY "perm update MP" ON public.matieres_premieres
  FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(), 'catalogue', 'update'));
CREATE POLICY "perm delete MP" ON public.matieres_premieres
  FOR DELETE TO authenticated USING (public.can_perform(auth.uid(), 'catalogue', 'delete'));

CREATE TRIGGER trg_mp_updated_at BEFORE UPDATE ON public.matieres_premieres
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_mp_nom ON public.matieres_premieres(nom);
