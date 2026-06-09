
-- Notifications in-app
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role_cible app_role,
  type text NOT NULL,
  titre text NOT NULL,
  message text NOT NULL,
  severite text NOT NULL DEFAULT 'info',
  lien text,
  lue boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voir ses notifications ou celles de son rôle"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (role_cible IS NOT NULL AND has_role(auth.uid(), role_cible))
    OR is_ceo(auth.uid())
  );

CREATE POLICY "Marquer comme lue"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (role_cible IS NOT NULL AND has_role(auth.uid(), role_cible))
    OR is_ceo(auth.uid())
  );

CREATE INDEX idx_notif_user_lue ON public.notifications(user_id, lue);
CREATE INDEX idx_notif_role_lue ON public.notifications(role_cible, lue);

-- Passage de quart : session reprise d'une précédente
ALTER TABLE public.sessions_caisse
  ADD COLUMN IF NOT EXISTS session_parent_id uuid REFERENCES public.sessions_caisse(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motif_fermeture text;

-- Fonction de génération des alertes (appelée par cron + à la demande)
CREATE OR REPLACE FUNCTION public.generer_alertes_systeme()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  -- Stock MP critique (< seuil)
  FOR r IN SELECT id, nom, stock_actuel, seuil_alerte FROM matieres_premieres
           WHERE stock_actuel IS NOT NULL AND seuil_alerte IS NOT NULL AND stock_actuel <= seuil_alerte LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='stock_mp_critique' AND lien=r.id::text AND created_at::date = CURRENT_DATE) THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','stock_mp_critique','Stock MP critique',
              r.nom || ' : ' || r.stock_actuel || ' (seuil ' || r.seuil_alerte || ')','warning',r.id::text);
    END IF;
  END LOOP;

  -- Écart caisse > 2000
  FOR r IN SELECT id, ecart, ferme_at FROM sessions_caisse
           WHERE statut LIKE 'fermee%' AND ABS(COALESCE(ecart,0)) > 2000
             AND ferme_at::date = CURRENT_DATE LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='ecart_caisse' AND lien=r.id::text) THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','ecart_caisse','Écart de caisse',
              'Écart de ' || r.ecart || ' F CFA détecté','warning',r.id::text);
    END IF;
  END LOOP;

  -- Crédits non soldés > 30 jours
  FOR r IN SELECT id, montant_restant, created_at FROM credits_clients
           WHERE statut='ouvert' AND created_at < now() - interval '30 days' LOOP
    IF NOT EXISTS (SELECT 1 FROM notifications WHERE type='credit_ancien' AND lien=r.id::text AND created_at > now() - interval '7 days') THEN
      INSERT INTO notifications(role_cible, type, titre, message, severite, lien)
      VALUES ('ceo','credit_ancien','Crédit non soldé > 30j',
              'Crédit de ' || r.montant_restant || ' F CFA en attente','danger',r.id::text);
    END IF;
  END LOOP;
END $$;

-- Cron : alertes toutes les 30 minutes
SELECT cron.unschedule('alertes-systeme') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='alertes-systeme');
SELECT cron.schedule('alertes-systeme', '*/30 * * * *', $$SELECT public.generer_alertes_systeme();$$);
