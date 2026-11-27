-- Run this ONCE in the Supabase SQL editor, then DELETE this file.
-- Needs the pg_cron and pg_net extensions (Dashboard > Database > Extensions).
select cron.schedule(
  'viva-renew-hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://kvnpixezrebxuvgbznqr.supabase.co/functions/v1/viva-renew',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'e124dd164dc122ee2e12ca0d1e9532b108e5ce8b3f6dd88491e19ef2944a76b2'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
-- To stop ALL Viva renewals at any time:  select cron.unschedule('viva-renew-hourly');
