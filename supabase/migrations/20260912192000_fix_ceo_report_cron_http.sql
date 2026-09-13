-- Preserve job identity/history; fix the HTTP call used for the 23:00 UTC report.
DO $migration$
DECLARE
  report_job_id bigint;
BEGIN
  SELECT jobid INTO report_job_id FROM cron.job WHERE jobname = 'rapport-journalier-ceo';
  IF report_job_id IS NULL THEN
    RAISE EXCEPTION 'Missing cron job rapport-journalier-ceo';
  END IF;
  PERFORM cron.alter_job(
    report_job_id,
    schedule := '0 23 * * *',
    command := $command$
SELECT net.http_post(
  url := 'https://rgdvlqwuhyrtmzraaowt.supabase.co/functions/v1/rapport-journalier-ceo',
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := jsonb_build_object('cron_token', (SELECT cron_token FROM public.parametres_email WHERE id = true)),
  timeout_milliseconds := 120000
);
$command$,
    active := true
  );
END;
$migration$;
