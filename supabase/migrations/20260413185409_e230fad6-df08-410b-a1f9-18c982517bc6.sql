SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://akbosdbyheezghieiefz.supabase.co/functions/v1/process-email-queue',
    headers:=format('{"Content-Type": "application/json", "Authorization": "Bearer %s"}', 
      current_setting('app.settings.service_role_key', true)
    )::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);