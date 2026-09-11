-- =============================================================
-- 03-fix-production-labo-trigger.sql
-- Supprime le trigger buggy qui bloque tout INSERT dans
-- production_labo (reference NEW.bon_transfert_id qui n'existe
-- pas dans cette table - hypothese fausse du generateur auto).
-- La consommation MP est deja geree par mp_mouvements.
-- A executer dans le Dashboard Supabase -> SQL Editor.
-- =============================================================

DROP TRIGGER IF EXISTS trg_update_consommation_mp
  ON public.production_labo;

DROP FUNCTION IF EXISTS public.update_consommation_mp();

SELECT 'Trigger buggy supprime avec succes' AS resultat;
