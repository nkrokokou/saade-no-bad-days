-- 1. Lien fiches_techniques -> matieres_premieres
ALTER TABLE public.fiches_techniques
  ADD COLUMN IF NOT EXISTS matiere_premiere_id UUID REFERENCES public.matieres_premieres(id) ON DELETE SET NULL;

ALTER TABLE public.fiches_techniques
  ALTER COLUMN matiere_premiere DROP NOT NULL;

-- 2. Trigger recalcul prix_cout produit
CREATE OR REPLACE FUNCTION public.recalc_produit_prix_cout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid UUID;
  v_total NUMERIC;
BEGIN
  v_pid := COALESCE(NEW.produit_id, OLD.produit_id);
  SELECT COALESCE(SUM(quantite_mp * cout_unitaire_mp), 0)
    INTO v_total
    FROM public.fiches_techniques
    WHERE produit_id = v_pid;
  UPDATE public.produits SET prix_cout = v_total, updated_at = now() WHERE id = v_pid;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recalc_produit_prix_cout ON public.fiches_techniques;
CREATE TRIGGER trg_recalc_produit_prix_cout
AFTER INSERT OR UPDATE OR DELETE ON public.fiches_techniques
FOR EACH ROW EXECUTE FUNCTION public.recalc_produit_prix_cout();

-- 3. Permissions par défaut pour matieres_premieres et tables_restaurant
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
  ('ceo', 'matieres_premieres', true, true, true, true),
  ('labo_patisserie', 'matieres_premieres', true, false, false, false),
  ('labo_viennoiserie', 'matieres_premieres', true, false, false, false),
  ('cuisine_salee', 'matieres_premieres', true, false, false, false),
  ('salle', 'matieres_premieres', false, false, false, false),
  ('ceo', 'tables_restaurant', true, true, true, true),
  ('labo_patisserie', 'tables_restaurant', false, false, false, false),
  ('labo_viennoiserie', 'tables_restaurant', false, false, false, false),
  ('cuisine_salee', 'tables_restaurant', false, false, false, false),
  ('salle', 'tables_restaurant', true, false, false, false)
ON CONFLICT DO NOTHING;