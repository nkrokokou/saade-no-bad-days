SELECT 'CRON' AS type, jobname AS nom, schedule AS detail FROM cron.job
UNION ALL
SELECT 'REALTIME', tablename, 'public' FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
ORDER BY type, nom;
