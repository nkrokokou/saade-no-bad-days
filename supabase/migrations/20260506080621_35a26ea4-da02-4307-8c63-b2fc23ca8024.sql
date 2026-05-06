
-- Sessions de caisse
CREATE TABLE IF NOT EXISTS public.sessions_caisse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ouvert_par uuid,
  ferme_par uuid,
  fond_initial numeric NOT NULL DEFAULT 0,
  fond_final_attendu numeric DEFAULT 0,
  fond_final_compte numeric DEFAULT 0,
  ecart numeric DEFAULT 0,
  statut text NOT NULL DEFAULT 'ouverte',
  ouvert_at timestamptz NOT NULL DEFAULT now(),
  ferme_at timestamptz,
  notes text
);
ALTER TABLE public.sessions_caisse ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read sessions" ON public.sessions_caisse FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'pos','read'));
CREATE POLICY "perm insert sessions" ON public.sessions_caisse FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'pos','create'));
CREATE POLICY "perm update sessions" ON public.sessions_caisse FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'pos','update'));
CREATE POLICY "perm delete sessions" ON public.sessions_caisse FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'pos','delete'));

-- Ventes (tickets)
CREATE TABLE IF NOT EXISTS public.ventes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions_caisse(id) ON DELETE SET NULL,
  numero_ticket bigserial,
  date_vente timestamptz NOT NULL DEFAULT now(),
  total numeric NOT NULL DEFAULT 0,
  remise_globale numeric NOT NULL DEFAULT 0,
  mode_paiement text NOT NULL DEFAULT 'especes',
  montant_recu numeric DEFAULT 0,
  rendu numeric DEFAULT 0,
  statut text NOT NULL DEFAULT 'validee',
  encaisse_par uuid,
  client_nom text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON public.ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_ventes_session ON public.ventes(session_id);
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read ventes" ON public.ventes FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'ventes','read') OR public.can_perform(auth.uid(),'pos','read'));
CREATE POLICY "perm insert ventes" ON public.ventes FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'pos','create'));
CREATE POLICY "perm update ventes" ON public.ventes FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'pos','update') OR public.can_perform(auth.uid(),'ventes','update'));
CREATE POLICY "perm delete ventes" ON public.ventes FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'ventes','delete'));

-- Lignes de vente
CREATE TABLE IF NOT EXISTS public.vente_lignes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id uuid NOT NULL REFERENCES public.ventes(id) ON DELETE CASCADE,
  produit_id uuid NOT NULL,
  produit_nom text NOT NULL,
  quantite numeric NOT NULL DEFAULT 1,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  remise numeric NOT NULL DEFAULT 0,
  total_ligne numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vlignes_vente ON public.vente_lignes(vente_id);
CREATE INDEX IF NOT EXISTS idx_vlignes_produit ON public.vente_lignes(produit_id);
ALTER TABLE public.vente_lignes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read vlignes" ON public.vente_lignes FOR SELECT TO authenticated USING (public.can_perform(auth.uid(),'ventes','read') OR public.can_perform(auth.uid(),'pos','read'));
CREATE POLICY "perm insert vlignes" ON public.vente_lignes FOR INSERT TO authenticated WITH CHECK (public.can_perform(auth.uid(),'pos','create'));
CREATE POLICY "perm update vlignes" ON public.vente_lignes FOR UPDATE TO authenticated USING (public.can_perform(auth.uid(),'pos','update'));
CREATE POLICY "perm delete vlignes" ON public.vente_lignes FOR DELETE TO authenticated USING (public.can_perform(auth.uid(),'ventes','delete'));

-- Default permissions for new modules
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
  ('salle','pos',true,true,true,false),
  ('salle','ventes',true,false,false,false),
  ('labo_patisserie','pos',false,false,false,false),
  ('labo_viennoiserie','pos',false,false,false,false),
  ('cuisine_salee','pos',false,false,false,false),
  ('labo_patisserie','ventes',false,false,false,false),
  ('labo_viennoiserie','ventes',false,false,false,false),
  ('cuisine_salee','ventes',false,false,false,false)
ON CONFLICT DO NOTHING;
