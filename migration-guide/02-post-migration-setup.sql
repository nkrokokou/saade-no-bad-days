-- ============================================================
-- POST-MIGRATION — À exécuter APRÈS le schéma complet
-- Projet : rgdvlqwuhyrtmzraaowt
-- ============================================================

-- 1) REALTIME : tables utilisées par les écrans live du frontend
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions_caisse;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ventes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pertes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_labo;
ALTER PUBLICATION supabase_realtime ADD TABLE public.achats_mp;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bons_transfert;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cloture_journaliere;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mouvements_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credits_clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.paiements_credits;

-- 2) CRON — rapport journalier 23h00
SELECT cron.unschedule('rapport-journalier-ceo')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rapport-journalier-ceo');

SELECT cron.schedule('rapport-journalier-ceo', '0 23 * * *', $$
  SELECT extensions.http_post(
    url := 'https://rgdvlqwuhyrtmzraaowt.supabase.co/functions/v1/rapport-journalier-ceo',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('cron_token', (SELECT cron_token FROM public.parametres_email WHERE id = true))
  );
$$);

-- 3) Vérification rapide
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
SELECT jobname, schedule FROM cron.job ORDER BY jobname;