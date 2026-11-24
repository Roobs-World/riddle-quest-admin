-- Run separately as postgres after schema, deployment and Vault configuration.
-- Vault names: notification_service_url (HTTPS origin), notification_cron_secret (CRON_SECRET).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $setup$
declare
  service_url text;
  cron_secret text;
begin
  if current_user <> 'postgres' then raise exception 'Notification scheduler setup requires postgres'; end if;
  select decrypted_secret into strict service_url from vault.decrypted_secrets where name = 'notification_service_url';
  select decrypted_secret into strict cron_secret from vault.decrypted_secrets where name = 'notification_cron_secret';
  if service_url !~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?/?$'
      or cron_secret !~ '^[A-Za-z0-9_-]{32,256}$' then
    raise exception 'Notification scheduler Vault configuration is invalid';
  end if;

  perform cron.schedule('notification-manager-dispatch', '* * * * *', $job$
    do $dispatch$
    declare
      service_url text;
      cron_secret text;
    begin
      select decrypted_secret into strict service_url from vault.decrypted_secrets where name = 'notification_service_url';
      select decrypted_secret into strict cron_secret from vault.decrypted_secrets where name = 'notification_cron_secret';
      if service_url !~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?/?$'
          or cron_secret !~ '^[A-Za-z0-9_-]{32,256}$' then
        raise exception 'Notification scheduler Vault configuration is invalid';
      end if;
      perform net.http_post(url := rtrim(service_url, '/') || '/api/cron/notifications',
        headers := jsonb_build_object('Authorization', 'Bearer ' || cron_secret, 'Content-Type', 'application/json'),
        body := '{}'::jsonb, timeout_milliseconds := 55000);
    end;
    $dispatch$;
  $job$);
end;
$setup$;
