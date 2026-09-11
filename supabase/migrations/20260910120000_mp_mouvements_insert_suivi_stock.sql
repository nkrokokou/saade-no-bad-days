-- Correctif RLS : l'Économat ne peut plus insérer de mouvement MP
-- (erreur rapportée : "new row violates row level security policy for table mp_mouvements")
--
-- Contexte :
--   La migration 20260619095450 a remplacé la politique d'INSERT permissive
--   (mp_mvt_insert_auth : WITH CHECK true) par mp_mvt_insert_ceo qui ne permet
--   QUE les CEO. Or la matrice module_permissions donne au rôle 'economat'
--   can_create=true sur le module 'suivi_stock', et l'écran
--   "Suivi de Stock → MP temps réel → Ajuster" (SuiviStock.tsx) insère un
--   mouvement de type 'ajustement' dans public.mp_mouvements.
--
--   can_perform() short-circuite déjà le CEO (retourne true), donc une
--   seule politique alignée sur la matrice suffit, cohérente avec les
--   politiques UPDATE (mp_mvt_update_ceo_eco) et le reste du schéma.

DROP POLICY IF EXISTS mp_mvt_insert_ceo ON public.mp_mouvements;
DROP POLICY IF EXISTS mp_mvt_insert_suivi_stock ON public.mp_mouvements;

CREATE POLICY mp_mvt_insert_suivi_stock ON public.mp_mouvements
  FOR INSERT TO authenticated
  WITH CHECK (public.can_perform(auth.uid(), 'suivi_stock', 'create'));