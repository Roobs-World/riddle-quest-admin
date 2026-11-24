create or replace function public.notification_register_firebase(p_id text, p_device_hash text, p_target text, p_revision bigint,
  p_enabled boolean, p_locale text, p_expires_at_ms bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.notification_installations%rowtype;
  now_at timestamptz := clock_timestamp();
  expiry_at timestamptz;
  endpoint_owner text;
begin
  if p_id !~ '^[a-f0-9]{64}$' or p_device_hash !~ '^[a-f0-9]{64}$' or p_target !~ '^[a-z][a-z0-9-]{0,63}$' or p_target = 'all' or p_enabled is null
      or p_revision < 0 or p_revision > 9007199254740991 or p_expires_at_ms < 0 or p_expires_at_ms > 9007199254740991 then
    raise sqlstate 'PT400' using message = 'firebase-registration-invalid';
  end if;
  expiry_at := case when p_enabled then to_timestamp(least(p_expires_at_ms,
    floor(extract(epoch from now_at + interval '30 days') * 1000)::bigint)::numeric / 1000)
    else now_at + interval '30 days' end;
  insert into public.notification_installations(id, target, transport, origin, revision, locale, status, expires_at)
    values (p_id, p_target, 'firebase', null, -1, p_locale, 'disabled', expiry_at) on conflict (id) do nothing;
  select * into current_row from public.notification_installations where id = p_id for update;
  if current_row.transport <> 'firebase' then raise sqlstate 'PT403' using message = 'installation-owner-mismatch'; end if;
  if p_revision < current_row.revision then
    return jsonb_build_object('installationId', p_id, 'revision', current_row.revision);
  end if;
  if p_enabled and p_expires_at_ms <= floor(extract(epoch from now_at) * 1000)::bigint then
    raise sqlstate 'PT400' using message = 'firebase-registration-expired';
  end if;
  if p_revision = current_row.revision and (current_row.target <> p_target or (p_enabled and
      (current_row.status <> 'active' or current_row.native_ref is distinct from p_device_hash))
      or (not p_enabled and current_row.status <> 'disabled')) then
    raise sqlstate 'PT409' using message = 'installation-revision-conflict';
  end if;
  if p_enabled then
    insert into public.notification_endpoints(endpoint_hash, installation_id, expires_at)
      values (p_id, p_id, expiry_at) on conflict (endpoint_hash) do update set expires_at = excluded.expires_at
      where public.notification_endpoints.installation_id = p_id returning installation_id into endpoint_owner;
    if not found then raise sqlstate 'PT409' using message = 'subscription-already-owned'; end if;
    update public.notification_installations set target = p_target, status = 'active', revision = p_revision, locale = p_locale,
      native_ref = p_device_hash, endpoint_hash = p_id,
      enrolled_at = case when p_revision > current_row.revision then now_at else current_row.enrolled_at end,
      updated_at = now_at, expires_at = expiry_at where id = p_id;
  else
    delete from public.notification_endpoints where installation_id = p_id;
    update public.notification_installations set target = p_target, status = 'disabled', revision = p_revision, locale = p_locale,
      native_ref = null, endpoint_hash = null, updated_at = now_at, expires_at = expiry_at where id = p_id;
  end if;
  return jsonb_build_object('installationId', p_id, 'revision', p_revision);
end;
$$;
revoke execute on function public.notification_register_firebase(text, text, text, bigint, boolean, text, bigint) from public, anon, authenticated;
grant execute on function public.notification_register_firebase(text, text, text, bigint, boolean, text, bigint) to service_role;
