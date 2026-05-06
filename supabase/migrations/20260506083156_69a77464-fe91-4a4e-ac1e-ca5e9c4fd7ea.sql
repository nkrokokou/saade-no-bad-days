
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  notes TEXT,
  plafond_credit NUMERIC NOT NULL DEFAULT 0,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read clients" ON public.clients FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'clients', 'read'));
CREATE POLICY "perm insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'clients', 'create'));
CREATE POLICY "perm update clients" ON public.clients FOR UPDATE TO authenticated USING (can_perform(auth.uid(), 'clients', 'update'));
CREATE POLICY "perm delete clients" ON public.clients FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'clients', 'delete'));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.credits_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  client_nom TEXT NOT NULL,
  vente_id UUID,
  montant_initial NUMERIC NOT NULL DEFAULT 0,
  montant_restant NUMERIC NOT NULL DEFAULT 0,
  date_credit DATE NOT NULL DEFAULT CURRENT_DATE,
  statut TEXT NOT NULL DEFAULT 'ouvert',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.credits_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read credits" ON public.credits_clients FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'clients', 'read') OR can_perform(auth.uid(), 'pos', 'read'));
CREATE POLICY "perm insert credits" ON public.credits_clients FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'pos', 'create') OR can_perform(auth.uid(), 'clients', 'create'));
CREATE POLICY "perm update credits" ON public.credits_clients FOR UPDATE TO authenticated USING (can_perform(auth.uid(), 'clients', 'update') OR can_perform(auth.uid(), 'pos', 'update'));
CREATE POLICY "perm delete credits" ON public.credits_clients FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'clients', 'delete'));
CREATE TRIGGER trg_credits_updated BEFORE UPDATE ON public.credits_clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.paiements_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits_clients(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL DEFAULT 0,
  mode_paiement TEXT NOT NULL DEFAULT 'especes',
  date_paiement TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.paiements_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read paiements" ON public.paiements_credits FOR SELECT TO authenticated USING (can_perform(auth.uid(), 'clients', 'read') OR can_perform(auth.uid(), 'pos', 'read'));
CREATE POLICY "perm insert paiements" ON public.paiements_credits FOR INSERT TO authenticated WITH CHECK (can_perform(auth.uid(), 'clients', 'update') OR can_perform(auth.uid(), 'pos', 'create'));
CREATE POLICY "perm delete paiements" ON public.paiements_credits FOR DELETE TO authenticated USING (can_perform(auth.uid(), 'clients', 'delete'));

ALTER TABLE public.ventes ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE OR REPLACE FUNCTION public.recalc_credit_restant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_credit_id UUID; v_initial NUMERIC; v_paye NUMERIC; v_restant NUMERIC;
BEGIN
  v_credit_id := COALESCE(NEW.credit_id, OLD.credit_id);
  SELECT montant_initial INTO v_initial FROM public.credits_clients WHERE id = v_credit_id;
  SELECT COALESCE(SUM(montant),0) INTO v_paye FROM public.paiements_credits WHERE credit_id = v_credit_id;
  v_restant := GREATEST(v_initial - v_paye, 0);
  UPDATE public.credits_clients
    SET montant_restant = v_restant,
        statut = CASE WHEN v_restant <= 0 THEN 'solde' ELSE 'ouvert' END
    WHERE id = v_credit_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_recalc_credit
AFTER INSERT OR UPDATE OR DELETE ON public.paiements_credits
FOR EACH ROW EXECUTE FUNCTION public.recalc_credit_restant();

INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
  ('salle', 'clients', true, true, true, false),
  ('ceo', 'clients', true, true, true, true);
