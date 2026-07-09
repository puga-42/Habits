-- Outbox refactor (3/3): schedule the dispatcher.
--
-- ⚠️ PREREQUISITE — pg_cron must be available. It is NOT currently enabled on
-- this project (the `cron.job` relation does not exist). If `supabase db push`
-- errors on `create extension pg_cron`, enable it once via Dashboard →
-- Database → Extensions (search "pg_cron"), then re-run the push. Verify with:
--   select 1 from cron.job;   -- should run without "relation does not exist"
--
-- If pg_cron is unavailable on the plan, use the external-scheduler fallback in
-- OUTBOX_NOTIFICATIONS_PLAN.md §7 instead of this migration (POST the function
-- URL from any cron service with the x-webhook-secret header, every minute).
--
-- Requires the Vault secrets used by the engagement trigger plus webhook_secret:
--   supabase_url, service_role_key, webhook_secret.

create extension if not exists pg_cron;
-- Idempotent (re)schedule: drop any prior job, then create it.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'notification-dispatch') then
    perform cron.unschedule('notification-dispatch');
  end if;
end $$;
select cron.schedule(
  'notification-dispatch',
  '* * * * *',  -- every minute; ≤60s latency for comments/requests
  $CRON$
    select extensions.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'supabase_url')
             || '/functions/v1/notification-dispatcher',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' ||
          (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
        'x-webhook-secret',
          (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')
      )
    );
  $CRON$
);
