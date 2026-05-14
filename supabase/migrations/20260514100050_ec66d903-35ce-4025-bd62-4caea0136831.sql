-- Clés étrangères manquantes
ALTER TABLE public.vente_lignes
  ADD CONSTRAINT vente_lignes_produit_id_fkey FOREIGN KEY (produit_id) REFERENCES public.produits(id) ON DELETE RESTRICT;

ALTER TABLE public.ventes
  ADD CONSTRAINT ventes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.credits_clients
  ADD CONSTRAINT credits_vente_id_fkey FOREIGN KEY (vente_id) REFERENCES public.ventes(id) ON DELETE SET NULL;

-- Permissions corrigées
INSERT INTO public.module_permissions (role, module, can_read, can_create, can_update, can_delete)
VALUES
  ('labo_patisserie', 'dashboard', true, false, false, false),
  ('labo_viennoiserie', 'dashboard', true, false, false, false),
  ('cuisine_salee', 'dashboard', true, false, false, false),
  ('salle', 'dashboard', true, false, false, false)
ON CONFLICT DO NOTHING;

UPDATE public.module_permissions
   SET can_read = true
 WHERE role = 'labo_patisserie' AND module = 'fiches_techniques';

-- Index performance
CREATE INDEX IF NOT EXISTS idx_vente_lignes_vente_id ON public.vente_lignes(vente_id);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_produit_id ON public.vente_lignes(produit_id);
CREATE INDEX IF NOT EXISTS idx_production_labo_date ON public.production_labo(date_production);
CREATE INDEX IF NOT EXISTS idx_cloture_date ON public.cloture_journaliere(date_cloture);
CREATE INDEX IF NOT EXISTS idx_degustations_date ON public.degustations(date_degustation);
CREATE INDEX IF NOT EXISTS idx_ventes_date ON public.ventes(date_vente);
CREATE INDEX IF NOT EXISTS idx_stock_tampon_date ON public.stock_tampon(date_stock);