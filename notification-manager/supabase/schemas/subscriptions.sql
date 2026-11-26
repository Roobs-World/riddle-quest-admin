create or replace function public.notification_consume_quota(p_address_hash text, p_installation_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  now_at timestamptz := clock_timestamp();
  minute_key text := floor(extract(epoch from now_at)/60)::bigint::text;
  accepted integer;
begin
  if p_address_hash !~ '^[a-f0-9]{64}$' or p_installation_id !~ '^[a-f0-9]{64}$' then
    raise sqlstate 'PT400' using message = 'notification-quota-key-invalid';
  end if;
  insert into public.notification_quotas(id, count, expires_at)
    values ('address:'||p_address_hash||':'||minute_key, 1, now_at + interval '1 day')
    on conflict (id) do update set count = public.notification_quotas.count + 1
      where public.notification_quotas.count < 30 returning count into accepted;
  if not found then raise sqlstate 'PT429' using message = 'notification-rate-limited'; end if;
  insert into public.notification_quotas(id, count, expires_at)
    values ('installation:'||p_installation_id||':'||minute_key, 1, now_at + interval '1 day')
    on conflict (id) do update set count = public.notification_quotas.count + 1
      where public.notification_quotas.count < 15 returning count into accepted;
  if not found then raise sqlstate 'PT429' using message = 'notification-rate-limited'; end if;
end;
$$;
revoke execute on function public.notification_consume_quota(text, text) from public, anon, authenticated;
grant execute on function public.notification_consume_quota(text, text) to service_role;

create or replace function public.notification_subscribe(p_id text, p_origin text, p_target text, p_revision bigint,
  p_locale text, p_subscription jsonb, p_endpoint_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  raise sqlstate 'PT410' using message = 'browser-push-retired';
end;
$$;
revoke execute on function public.notification_subscribe(text, text, text, bigint, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.notification_subscribe(text, text, text, bigint, text, jsonb, text) to service_role;

create or replace function public.notification_unsubscribe(p_id text, p_origin text, p_target text, p_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  now_at timestamptz := clock_timestamp();
  current_row public.notification_installations%rowtype;
  accepted integer;
begin
  if p_id !~ '^[a-f0-9]{64}$' or p_revision < 0 or p_revision > 9007199254740991 then
    raise sqlstate 'PT400' using message = 'installation-input-invalid';
  end if;
  insert into public.notification_installations(id, target, origin, revision, locale, status, enrolled_at, expires_at)
    values (p_id, p_target, p_origin, -1, 'en', 'disabled', now_at, now_at + interval '30 days') on conflict (id) do nothing;
  if found then
    insert into public.notification_quotas(id, count, expires_at)
      values ('new:'||p_origin||':'||to_char(now_at at time zone 'UTC', 'YYYY-MM-DD'), 1, now_at + interval '2 days')
      on conflict (id) do update set count = public.notification_quotas.count + 1
        where public.notification_quotas.count < 1000 returning count into accepted;
    if not found then raise sqlstate 'PT429' using message = 'notification-registration-limited'; end if;
  end if;
  select * into current_row from public.notification_installations where id = p_id for update;
  if current_row.transport <> 'web-push' or current_row.target <> p_target or current_row.origin is distinct from p_origin then raise sqlstate 'PT403' using message = 'installation-owner-mismatch'; end if;
  if p_revision < current_row.revision then raise sqlstate 'PT409' using message = 'installation-revision-stale'; end if;
  if p_revision = current_row.revision then
    if current_row.status = 'disabled' then return jsonb_build_object('installationId', p_id, 'revision', p_revision); end if;
    raise sqlstate 'PT409' using message = 'installation-revision-conflict';
  end if;
  delete from public.notification_endpoints where installation_id = p_id;
  update public.notification_installations set status = 'disabled', revision = p_revision, subscription = null,
    endpoint_hash = null, updated_at = now_at, expires_at = now_at + interval '30 days' where id = p_id;
  return jsonb_build_object('installationId', p_id, 'revision', p_revision);
end;
$$;
revoke execute on function public.notification_unsubscribe(text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.notification_unsubscribe(text, text, text, bigint) to service_role;

create or replace function public.notification_activity(p_id text, p_origin text, p_target text, p_locale text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  raise sqlstate 'PT410' using message = 'browser-push-retired';
end;
$$;
revoke execute on function public.notification_activity(text, text, text, text) from public, anon, authenticated;
grant execute on function public.notification_activity(text, text, text, text) to service_role;
