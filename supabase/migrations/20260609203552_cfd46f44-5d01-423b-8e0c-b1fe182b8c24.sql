
-- ============================================================
-- PHASE 1 — Foundation migration (sous-catégories, imprimantes,
-- crédits, palettes, sous-permissions, clôture auto)
-- ============================================================

-- 1. Sous-catégories hiérarchiques + imprimante cible par catégorie
ALTER TABLE public.categories_produits
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories_produits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imprimante_cible text DEFAULT 'chaud' CHECK (imprimante_cible IN ('chaud','froid','caisse','aucune'));

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories_produits(parent_id);

-- 2. Imprimante cible override par produit (optionnel, sinon hérite de la catégorie)
ALTER TABLE public.produits
  ADD COLUMN IF NOT EXISTS imprimante_cible text CHECK (imprimante_cible IN ('chaud','froid','caisse','aucune'));

-- 3. Crédits clients — pas de décrémentation stock à la création
-- statut ventes peut être 'credit_pending' (créé) -> 'vente' (soldé)
-- Trigger: à la création d'un crédit, on marque la vente credit_pending
-- À la conversion (statut credit -> solde), on génère les mouvements de stock
CREATE OR REPLACE FUNCTION public.handle_credit_settlement()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ligne RECORD;
BEGIN
  -- Quand un crédit passe à 'solde', générer les mouvements de stock pour la vente liée
  IF NEW.statut = 'solde' AND COALESCE(OLD.statut,'') <> 'solde' AND NEW.vente_id IS NOT NULL THEN
    -- Marquer la vente comme finalisée
    UPDATE public.ventes SET statut = 'vente' WHERE id = NEW.vente_id AND statut = 'credit_pending';
    -- Générer mouvements de stock (sortie)
    FOR v_ligne IN SELECT produit_id, quantite FROM public.vente_lignes WHERE vente_id = NEW.vente_id AND produit_id IS NOT NULL LOOP
      INSERT INTO public.mouvements_stock (date_mouvement, produit_id, type, quantite, motif, created_by)
      VALUES (CURRENT_DATE, v_ligne.produit_id, 'sortie', v_ligne.quantite, 'Crédit soldé — vente '||NEW.vente_id, NEW.created_by);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_credit_settlement ON public.credits_clients;
CREATE TRIGGER trg_credit_settlement
  AFTER UPDATE OF statut ON public.credits_clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_credit_settlement();

-- 4. Sous-permissions (submodule) — colonne optionnelle
ALTER TABLE public.module_permissions
  ADD COLUMN IF NOT EXISTS submodule text;

-- Index pour can_perform
CREATE INDEX IF NOT EXISTS idx_module_perms_role_module ON public.module_permissions(role, module);

-- 5. Préférences UI utilisateur (palette + thème)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  palette text NOT NULL DEFAULT 'saade_classic',
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','auto')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own prefs read" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own prefs insert" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own prefs update" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_prefs_updated BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Clôture automatique caisse à 23h59 — fonction utilisée par cron
CREATE OR REPLACE FUNCTION public.auto_close_open_sessions()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_total_ventes numeric;
BEGIN
  FOR v_session IN SELECT id, fond_initial FROM public.sessions_caisse WHERE statut = 'ouverte' LOOP
    SELECT COALESCE(SUM(total),0) INTO v_total_ventes
      FROM public.ventes
      WHERE session_id = v_session.id AND mode_paiement IN ('especes','cash');
    UPDATE public.sessions_caisse
      SET statut = 'fermee_auto',
          ferme_at = now(),
          fond_final_attendu = v_session.fond_initial + COALESCE(v_total_ventes,0),
          notes = COALESCE(notes,'') || ' [Fermeture automatique 23h59]'
      WHERE id = v_session.id;
  END LOOP;
END $$;

-- 7. Cron pg_cron + pg_net pour fermeture auto à 23:59 (heure serveur UTC)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop ancien job s'il existe
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'auto-close-cash-sessions' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'auto-close-cash-sessions',
  '59 22 * * *',  -- 22:59 UTC = 23:59 Lomé (GMT+0/+1 selon période; Togo = GMT+0)
  $$ SELECT public.auto_close_open_sessions(); $$
);

-- 8. Catégories produits — granter aux roles
GRANT SELECT ON public.categories_produits TO anon;
