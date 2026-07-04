-- SEC-2 (SQL side): the engagement push trigger calls the notify-on-engagement
-- edge function via pg_net. That function now requires an x-webhook-secret
-- header, so add it here. The secret lives in Vault alongside the existing
-- supabase_url / service_role_key secrets — store it once:
--
--   select vault.create_secret('<your-hex-secret>', 'webhook_secret');
--
-- and set the SAME value as the edge-function secret:
--
--   supabase secrets set WEBHOOK_SECRET=<your-hex-secret>
--
-- Also pins search_path (SEC-7 hardening) since this SECURITY DEFINER function
-- reads the service-role key from Vault.

create or replace function public.invoke_notify_on_engagement()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  _project_url    text;
  _service_key    text;
  _webhook_secret text;
begin
  select decrypted_secret into _project_url
    from vault.decrypted_secrets where name = 'supabase_url' limit 1;
  select decrypted_secret into _service_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  select decrypted_secret into _webhook_secret
    from vault.decrypted_secrets where name = 'webhook_secret' limit 1;

  if _project_url is null or _service_key is null or _webhook_secret is null then
    raise warning
      'Missing supabase_url, service_role_key, or webhook_secret in Vault — skipping push';
    return new;
  end if;

  perform extensions.http_post(
    url     := _project_url || '/functions/v1/notify-on-engagement',
    body    := jsonb_build_object(
                 'type',   TG_OP,
                 'table',  TG_TABLE_NAME,
                 'schema', TG_TABLE_SCHEMA,
                 'record', to_jsonb(new)
               ),
    headers := jsonb_build_object(
                 'Content-Type',     'application/json',
                 'Authorization',    'Bearer ' || _service_key,
                 'x-webhook-secret', _webhook_secret
               )
  );

  return new;
end;
$$;
