SELECT cron.schedule(
  'rapport-journalier-ceo',
  '0 23 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://ybbrjwywpeurimiisjwm.supabase.co/functions/v1/rapport-journalier-ceo',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);