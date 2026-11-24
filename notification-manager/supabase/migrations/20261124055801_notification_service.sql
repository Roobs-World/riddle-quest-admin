-- Initial migration generated from config.toml schema_paths for an empty application schema.

-- Source: ./schemas/notifications.sql
create table public.notification_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.notification_installations (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  target text not null check (target ~ '^[a-z][a-z0-9-]{0,63}$'),
  transport text not null default 'web-push' check (transport in ('web-push', 'android')),
  origin text,
  revision bigint not null check (revision >= -1),
  locale text not null,
  status text not null check (status in ('active', 'disabled')),
  subscription jsonb,
  native_ref text check (native_ref is null or native_ref ~ '^[a-f0-9]{64}$'),
  endpoint_hash text,
  enrolled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint notification_installation_transport check (
    (transport = 'web-push' and origin is not null and target not in ('android', 'all') and native_ref is null)
    or (transport = 'android' and origin is null and target = 'android' and subscription is null)
  ),
  constraint notification_installation_state check (
    (status = 'active' and endpoint_hash is not null and endpoint_hash ~ '^[a-f0-9]{64}$' and enrolled_at is not null
      and (transport = 'web-push' and subscription is not null or transport = 'android' and native_ref is not null))
    or (status = 'disabled' and subscription is null and native_ref is null and endpoint_hash is null)
  )
);
create index notification_installations_active_target_id on public.notification_installations(target, id) where status = 'active';
create index notification_installations_expiry on public.notification_installations(expires_at);

create table public.notification_endpoints (
  endpoint_hash text primary key check (endpoint_hash ~ '^[a-f0-9]{64}$'),
  installation_id text not null unique references public.notification_installations(id) on delete cascade,
  expires_at timestamptz not null
);

create table public.notification_quotas (
  id text primary key,
  count integer not null check (count >= 0),
  expires_at timestamptz not null
);
create index notification_quotas_expiry on public.notification_quotas(expires_at);

create table public.notification_campaigns (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  request_id text not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  created_by uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 2000),
  image_url text check (image_url is null or char_length(image_url) <= 2048 and image_url like 'https://%'),
  target text not null,
  send_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null check (status in ('queued', 'sending', 'complete', 'cancelled')),
  attempted integer not null default 0 check (attempted >= 0),
  accepted integer not null default 0 check (accepted >= 0),
  failed integer not null default 0 check (failed >= 0),
  uncertain integer not null default 0 check (uncertain >= 0),
  skipped integer not null default 0 check (skipped >= 0),
  cursor text,
  started_at timestamptz,
  next_run_at timestamptz,
  lease_id text,
  lease_until timestamptz not null default 'epoch',
  expires_at timestamptz,
  constraint notification_campaign_state check (
    (status in ('queued', 'sending') and next_run_at is not null)
    or (status in ('complete', 'cancelled') and next_run_at is null)
  ),
  constraint notification_campaign_counts check (attempted = accepted + failed + uncertain),
  unique (created_by, request_id)
);
create index notification_campaigns_due on public.notification_campaigns(next_run_at) where status in ('queued', 'sending');
create index notification_campaigns_created on public.notification_campaigns(created_at desc, id desc);
create index notification_campaigns_active_created on public.notification_campaigns(created_at desc, id desc) where status in ('queued', 'sending');
create index notification_campaigns_history_created on public.notification_campaigns(created_at desc, id desc) where status in ('complete', 'cancelled');
create index notification_campaigns_expiry on public.notification_campaigns(expires_at) where expires_at is not null;

create table public.notification_attempts (
  id text primary key,
  campaign_id text not null references public.notification_campaigns(id) on delete cascade,
  installation_id text not null,
  revision bigint not null,
  phase text not null check (phase in ('uncertain', 'accepted', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  expires_at timestamptz not null,
  unique (campaign_id, installation_id)
);
create index notification_attempts_expiry on public.notification_attempts(expires_at);

alter table public.notification_operators enable row level security;
alter table public.notification_installations enable row level security;
alter table public.notification_endpoints enable row level security;
alter table public.notification_quotas enable row level security;
alter table public.notification_campaigns enable row level security;
alter table public.notification_attempts enable row level security;

revoke all on public.notification_operators, public.notification_installations, public.notification_endpoints,
  public.notification_quotas, public.notification_campaigns, public.notification_attempts from public, anon, authenticated;
grant all on public.notification_operators, public.notification_installations, public.notification_endpoints,
  public.notification_quotas, public.notification_campaigns, public.notification_attempts to service_role;
grant select on public.notification_operators to authenticated;

create policy notification_operator_self on public.notification_operators for select to authenticated
  using ((select auth.uid()) = user_id);

create policy notification_image_operator_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'notification-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.notification_operators where user_id = (select auth.uid())));
create policy notification_image_operator_select on storage.objects for select to authenticated
  using (bucket_id = 'notification-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.notification_operators where user_id = (select auth.uid())));
create policy notification_image_operator_delete on storage.objects for delete to authenticated
  using (bucket_id = 'notification-images' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.notification_operators where user_id = (select auth.uid())));

create or replace function public.notification_installation_json(p_row public.notification_installations)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('target', p_row.target, 'transport', p_row.transport, 'origin', p_row.origin, 'revision', p_row.revision,
    'locale', p_row.locale, 'status', p_row.status, 'createdAtMs', floor(extract(epoch from p_row.created_at)*1000)::bigint,
    'updatedAtMs', floor(extract(epoch from p_row.updated_at)*1000)::bigint,
    'expiresAtMs', floor(extract(epoch from p_row.expires_at)*1000)::bigint,
    'enrolledAtMs', floor(extract(epoch from p_row.enrolled_at)*1000)::bigint)
    || case when p_row.status <> 'active' then '{}'::jsonb
      when p_row.transport = 'web-push' then jsonb_build_object('subscription', p_row.subscription, 'endpointHash', p_row.endpoint_hash)
      else jsonb_build_object('nativeRef', p_row.native_ref, 'endpointHash', p_row.endpoint_hash) end;
$$;
revoke execute on function public.notification_installation_json(public.notification_installations) from public, anon, authenticated;
grant execute on function public.notification_installation_json(public.notification_installations) to service_role;

create or replace function public.notification_campaign_json(p_row public.notification_campaigns)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('requestId', p_row.request_id, 'fingerprint', p_row.fingerprint, 'createdBy', p_row.created_by,
    'title', p_row.title, 'body', p_row.body, 'imageUrl', p_row.image_url, 'target', p_row.target, 'status', p_row.status,
    'sendAtMs', floor(extract(epoch from p_row.send_at)*1000)::bigint,
    'createdAtMs', floor(extract(epoch from p_row.created_at)*1000)::bigint,
    'updatedAtMs', floor(extract(epoch from p_row.updated_at)*1000)::bigint,
    'counts', jsonb_build_object('attempted', p_row.attempted, 'accepted', p_row.accepted,
      'failed', p_row.failed, 'uncertain', p_row.uncertain, 'skipped', p_row.skipped),
    'cursor', p_row.cursor, 'startedAtMs', floor(extract(epoch from p_row.started_at)*1000)::bigint,
    'leaseId', p_row.lease_id, 'leaseUntilMs', floor(extract(epoch from p_row.lease_until)*1000)::bigint)
    || case when p_row.next_run_at is not null then jsonb_build_object('nextRunAtMs', floor(extract(epoch from p_row.next_run_at)*1000)::bigint) else '{}'::jsonb end;
$$;
revoke execute on function public.notification_campaign_json(public.notification_campaigns) from public, anon, authenticated;
grant execute on function public.notification_campaign_json(public.notification_campaigns) to service_role;

-- Source: ./schemas/subscriptions.sql
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
declare
  now_at timestamptz := clock_timestamp();
  current_row public.notification_installations%rowtype;
  endpoint_owner text;
  accepted integer;
begin
  if p_id !~ '^[a-f0-9]{64}$' or p_endpoint_hash !~ '^[a-f0-9]{64}$' or p_revision < 0 or p_revision > 9007199254740991 then
    raise sqlstate 'PT400' using message = 'installation-input-invalid';
  end if;
  insert into public.notification_installations(id, target, origin, revision, locale, status, expires_at)
    values (p_id, p_target, p_origin, -1, p_locale, 'disabled', now_at + interval '30 days') on conflict (id) do nothing;
  select * into current_row from public.notification_installations where id = p_id for update;
  if current_row.transport <> 'web-push' or current_row.target <> p_target or current_row.origin is distinct from p_origin then
    raise sqlstate 'PT403' using message = 'installation-owner-mismatch';
  end if;
  if p_revision < current_row.revision then raise sqlstate 'PT409' using message = 'installation-revision-stale'; end if;
  if p_revision = current_row.revision then
    if current_row.status = 'active' and current_row.endpoint_hash = p_endpoint_hash and current_row.subscription = p_subscription then
      return jsonb_build_object('installationId', p_id, 'revision', p_revision);
    end if;
    raise sqlstate 'PT409' using message = 'installation-revision-conflict';
  end if;
  select installation_id into endpoint_owner from public.notification_endpoints where endpoint_hash = p_endpoint_hash for update;
  if found and endpoint_owner <> p_id then raise sqlstate 'PT409' using message = 'subscription-already-owned'; end if;
  if current_row.enrolled_at is null then
    insert into public.notification_quotas(id, count, expires_at)
      values ('new:'||p_origin||':'||to_char(now_at at time zone 'UTC', 'YYYY-MM-DD'), 1, now_at + interval '2 days')
      on conflict (id) do update set count = public.notification_quotas.count + 1
        where public.notification_quotas.count < 1000 returning count into accepted;
    if not found then raise sqlstate 'PT429' using message = 'notification-registration-limited'; end if;
  end if;
  delete from public.notification_endpoints where installation_id = p_id and endpoint_hash <> p_endpoint_hash;
  insert into public.notification_endpoints(endpoint_hash, installation_id, expires_at)
    values (p_endpoint_hash, p_id, now_at + interval '30 days')
    on conflict (endpoint_hash) do update set expires_at = excluded.expires_at
      where public.notification_endpoints.installation_id = p_id returning installation_id into endpoint_owner;
  if not found then raise sqlstate 'PT409' using message = 'subscription-already-owned'; end if;
  update public.notification_installations set status = 'active', revision = p_revision, locale = p_locale,
    subscription = p_subscription, endpoint_hash = p_endpoint_hash, enrolled_at = coalesce(enrolled_at, now_at),
    updated_at = now_at, expires_at = now_at + interval '30 days' where id = p_id;
  return jsonb_build_object('installationId', p_id, 'revision', p_revision);
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
declare
  now_at timestamptz := clock_timestamp();
  current_row public.notification_installations%rowtype;
begin
  select * into current_row from public.notification_installations where id = p_id for update;
  if not found or current_row.status <> 'active' then raise sqlstate 'PT404' using message = 'installation-not-active'; end if;
  if current_row.transport <> 'web-push' or current_row.origin is distinct from p_origin or current_row.target <> p_target then raise sqlstate 'PT403' using message = 'installation-owner-mismatch'; end if;
  if current_row.expires_at <= now_at then raise sqlstate 'PT410' using message = 'installation-expired'; end if;
  perform 1 from public.notification_endpoints where endpoint_hash = current_row.endpoint_hash and installation_id = p_id for update;
  if not found then raise sqlstate 'PT409' using message = 'subscription-owner-mismatch'; end if;
  update public.notification_installations set locale = p_locale, updated_at = now_at, expires_at = now_at + interval '30 days' where id = p_id;
  update public.notification_endpoints set expires_at = now_at + interval '30 days' where installation_id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.notification_activity(text, text, text, text) from public, anon, authenticated;
grant execute on function public.notification_activity(text, text, text, text) to service_role;

-- Source: ./schemas/android.sql
create or replace function public.notification_register_android(p_id text, p_token_hash text, p_revision bigint,
  p_enabled boolean, p_locale text, p_expires_at_ms bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.notification_installations%rowtype;
  now_at timestamptz := clock_timestamp();
  expiry_at timestamptz;
  endpoint_owner text;
begin
  if p_id !~ '^[a-f0-9]{64}$' or p_token_hash !~ '^[a-f0-9]{64}$' or p_enabled is null
      or p_revision < 0 or p_revision > 9007199254740991 or p_expires_at_ms < 0 or p_expires_at_ms > 9007199254740991 then
    raise sqlstate 'PT400' using message = 'android-registration-invalid';
  end if;
  expiry_at := case when p_enabled then to_timestamp(least(p_expires_at_ms,
    floor(extract(epoch from now_at + interval '30 days') * 1000)::bigint)::numeric / 1000)
    else now_at + interval '30 days' end;
  insert into public.notification_installations(id, target, transport, origin, revision, locale, status, expires_at)
    values (p_id, 'android', 'android', null, -1, p_locale, 'disabled', expiry_at) on conflict (id) do nothing;
  select * into current_row from public.notification_installations where id = p_id for update;
  if current_row.transport <> 'android' then raise sqlstate 'PT403' using message = 'installation-owner-mismatch'; end if;
  if p_revision < current_row.revision then
    return jsonb_build_object('installationId', p_id, 'revision', current_row.revision);
  end if;
  if p_enabled and p_expires_at_ms <= floor(extract(epoch from now_at) * 1000)::bigint then
    raise sqlstate 'PT400' using message = 'android-registration-expired';
  end if;
  if p_revision = current_row.revision and ((p_enabled and
      (current_row.status <> 'active' or current_row.native_ref is distinct from p_token_hash))
      or (not p_enabled and current_row.status <> 'disabled')) then
    raise sqlstate 'PT409' using message = 'installation-revision-conflict';
  end if;
  if p_enabled then
    insert into public.notification_endpoints(endpoint_hash, installation_id, expires_at)
      values (p_id, p_id, expiry_at) on conflict (endpoint_hash) do update set expires_at = excluded.expires_at
      where public.notification_endpoints.installation_id = p_id returning installation_id into endpoint_owner;
    if not found then raise sqlstate 'PT409' using message = 'subscription-already-owned'; end if;
    update public.notification_installations set status = 'active', revision = p_revision, locale = p_locale,
      native_ref = p_token_hash, endpoint_hash = p_id,
      enrolled_at = case when p_revision > current_row.revision then now_at else current_row.enrolled_at end,
      updated_at = now_at, expires_at = expiry_at where id = p_id;
  else
    delete from public.notification_endpoints where installation_id = p_id;
    update public.notification_installations set status = 'disabled', revision = p_revision, locale = p_locale,
      native_ref = null, endpoint_hash = null, updated_at = now_at, expires_at = expiry_at where id = p_id;
  end if;
  return jsonb_build_object('installationId', p_id, 'revision', p_revision);
end;
$$;
revoke execute on function public.notification_register_android(text, text, bigint, boolean, text, bigint) from public, anon, authenticated;
grant execute on function public.notification_register_android(text, text, bigint, boolean, text, bigint) to service_role;

-- Source: ./schemas/campaigns.sql
create or replace function public.notification_create_campaign(p_id text, p_operator uuid, p_request_id text,
  p_fingerprint text, p_title text, p_body text, p_image_url text, p_target text, p_send_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.notification_campaigns%rowtype;
  now_at timestamptz;
begin
  if not exists (select 1 from public.notification_operators where user_id = p_operator) then
    raise sqlstate 'PT403' using message = 'operator-access-denied';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id, 7));
  select * into current_row from public.notification_campaigns where id = p_id for update;
  if found then
    if current_row.fingerprint <> p_fingerprint or current_row.created_by <> p_operator then
      raise sqlstate 'PT409' using message = 'campaign-request-conflict';
    end if;
    return jsonb_build_object('id', p_id);
  end if;
  now_at := clock_timestamp();
  if p_send_at is not null and (not isfinite(p_send_at) or p_send_at <= now_at) then
    raise sqlstate 'PT400' using message = 'campaign-schedule-must-be-future';
  end if;
  insert into public.notification_campaigns(id, request_id, fingerprint, created_by, title, body, image_url,
    target, send_at, status, next_run_at)
    values (p_id, p_request_id, p_fingerprint, p_operator, p_title, p_body, p_image_url,
      p_target, coalesce(p_send_at, now_at), 'queued', coalesce(p_send_at, now_at));
  return jsonb_build_object('id', p_id);
end;
$$;
revoke execute on function public.notification_create_campaign(text, uuid, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.notification_create_campaign(text, uuid, text, text, text, text, text, text, timestamptz) to service_role;

create or replace function public.notification_read_campaign(p_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.notification_campaign_json(c) from public.notification_campaigns c where c.id = p_id;
$$;
revoke execute on function public.notification_read_campaign(text) from public, anon, authenticated;
grant execute on function public.notification_read_campaign(text) to service_role;

create or replace function public.notification_list_campaigns(p_view text, p_limit integer, p_before_at timestamptz, p_before_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with candidates as materialized (
    select c.id, c.created_at, c as campaign_row from public.notification_campaigns c
    where p_view in ('all', 'active', 'history') and p_limit between 1 and 100
      and ((p_before_at is null and p_before_id is null)
        or (c.created_at, c.id) < (p_before_at, p_before_id))
      and (p_view = 'all' or p_view = 'active' and c.status in ('queued', 'sending')
        or p_view = 'history' and c.status in ('complete', 'cancelled'))
    order by c.created_at desc, c.id desc limit p_limit + 1
  ), page as materialized (
    select * from candidates order by created_at desc, id desc limit p_limit
  )
  select jsonb_build_object('entries', coalesce((select jsonb_agg(jsonb_build_object('id', p.id,
      'campaign', public.notification_campaign_json(p.campaign_row)) order by p.created_at desc, p.id desc)
      from page p), '[]'::jsonb),
    'nextCursor', case when (select count(*) from candidates) > p_limit then
      (select jsonb_build_object('at', created_at, 'id', id) from page order by created_at, id limit 1)
      else null end);
$$;
revoke execute on function public.notification_list_campaigns(text, integer, timestamptz, text) from public, anon, authenticated;
grant execute on function public.notification_list_campaigns(text, integer, timestamptz, text) to service_role;

create or replace function public.notification_cancel_campaign(p_id text, p_operator uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.notification_operators where user_id = p_operator) then
    raise sqlstate 'PT403' using message = 'operator-access-denied';
  end if;
  perform 1 from public.notification_campaigns where id = p_id for update;
  if not found then raise sqlstate 'PT404' using message = 'campaign-not-found'; end if;
  update public.notification_campaigns set status = 'cancelled', updated_at = clock_timestamp(),
    next_run_at = null, lease_id = null, lease_until = 'epoch', expires_at = clock_timestamp() + interval '90 days'
    where id = p_id and status in ('queued', 'sending');
end;
$$;
revoke execute on function public.notification_cancel_campaign(text, uuid) from public, anon, authenticated;
grant execute on function public.notification_cancel_campaign(text, uuid) to service_role;

create or replace function public.notification_claim_campaign(p_id text, p_lease_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.notification_campaigns%rowtype;
  now_at timestamptz := clock_timestamp();
begin
  select * into current_row from public.notification_campaigns where id = p_id for update skip locked;
  if not found or current_row.status not in ('queued', 'sending') or current_row.send_at > now_at or current_row.lease_until > now_at then return null; end if;
  update public.notification_campaigns set status = 'sending', lease_id = p_lease_id, lease_until = now_at + interval '90 seconds',
    started_at = coalesce(started_at, now_at), updated_at = now_at where id = p_id returning * into current_row;
  return public.notification_campaign_json(current_row);
end;
$$;
revoke execute on function public.notification_claim_campaign(text, text) from public, anon, authenticated;
grant execute on function public.notification_claim_campaign(text, text) to service_role;

create or replace function public.notification_installation_page(p_campaign_id text, p_cursor text, p_limit integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(q.id order by q.id), '[]'::jsonb) from (
    select i.id from public.notification_installations i join public.notification_campaigns c on c.id = p_campaign_id
    where i.status = 'active' and i.expires_at > statement_timestamp()
      and c.status = 'sending' and (p_cursor is null or i.id > p_cursor) and (c.target = 'all' or i.target = c.target)
      and i.created_at <= c.started_at and (i.transport <> 'android' or i.enrolled_at <= c.started_at)
    order by i.id limit greatest(0, least(p_limit, 50))
  ) q;
$$;
revoke execute on function public.notification_installation_page(text, text, integer) from public, anon, authenticated;
grant execute on function public.notification_installation_page(text, text, integer) to service_role;

create or replace function public.notification_finish_campaign_batch(p_id text, p_lease_id text, p_cursor text, p_finished boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.notification_campaigns where id = p_id for update;
  update public.notification_campaigns set cursor = p_cursor, status = case when p_finished then 'complete' else 'sending' end,
    lease_id = null, lease_until = 'epoch', updated_at = clock_timestamp(),
    next_run_at = case when p_finished then null else clock_timestamp() end,
    expires_at = case when p_finished then clock_timestamp() + interval '90 days' else null end
    where id = p_id and lease_id = p_lease_id and status = 'sending';
end;
$$;
revoke execute on function public.notification_finish_campaign_batch(text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.notification_finish_campaign_batch(text, text, text, boolean) to service_role;

create or replace function public.notification_due_campaigns()
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(q.id order by q.next_run_at), '[]'::jsonb) from (
    select c.id, c.next_run_at from public.notification_campaigns c
    where c.status in ('queued', 'sending') and c.next_run_at <= clock_timestamp() and c.lease_until <= clock_timestamp()
    order by c.next_run_at limit 10 for update skip locked
  ) q;
$$;
revoke execute on function public.notification_due_campaigns() from public, anon, authenticated;
grant execute on function public.notification_due_campaigns() to service_role;

-- Source: ./schemas/delivery.sql
create or replace function public.notification_claim_delivery(p_campaign_id text, p_installation_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  campaign_row public.notification_campaigns%rowtype;
  installation_row public.notification_installations%rowtype;
  attempt_id text := p_campaign_id||':'||p_installation_id;
  now_at timestamptz := clock_timestamp();
begin
  select * into campaign_row from public.notification_campaigns where id = p_campaign_id for update;
  if not found or campaign_row.status not in ('queued', 'sending') or campaign_row.send_at > now_at then return null; end if;
  if exists (select 1 from public.notification_attempts where id = attempt_id) then return null; end if;
  select * into installation_row from public.notification_installations where id = p_installation_id for update;
  if not found or installation_row.status <> 'active' or installation_row.expires_at <= now_at
      or installation_row.created_at > coalesce(campaign_row.started_at, now_at)
      or (installation_row.transport = 'android' and installation_row.enrolled_at > coalesce(campaign_row.started_at, now_at))
      or (campaign_row.target <> 'all' and campaign_row.target <> installation_row.target) then return null; end if;
  perform 1 from public.notification_endpoints where endpoint_hash = installation_row.endpoint_hash
    and installation_id = p_installation_id for update;
  if not found then return null; end if;
  insert into public.notification_attempts(id, campaign_id, installation_id, revision, phase, expires_at)
    values (attempt_id, p_campaign_id, p_installation_id, installation_row.revision, 'uncertain', now_at + interval '90 days')
    on conflict (id) do nothing;
  if not found then return null; end if;
  update public.notification_campaigns set attempted = attempted + 1, uncertain = uncertain + 1,
    updated_at = now_at where id = p_campaign_id;
  return jsonb_build_object('attemptId', attempt_id, 'installation', public.notification_installation_json(installation_row), 'revision', installation_row.revision);
end;
$$;
revoke execute on function public.notification_claim_delivery(text, text) from public, anon, authenticated;
grant execute on function public.notification_claim_delivery(text, text) to service_role;

create or replace function public.notification_admit_delivery(p_campaign_id text, p_installation_id text, p_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  campaign_row public.notification_campaigns%rowtype;
  installation_row public.notification_installations%rowtype;
begin
  select * into campaign_row from public.notification_campaigns where id = p_campaign_id for share;
  if not found or campaign_row.status not in ('queued', 'sending') or campaign_row.send_at > clock_timestamp() then return null; end if;
  select * into installation_row from public.notification_installations where id = p_installation_id for share;
  if not found or installation_row.status <> 'active' or installation_row.revision <> p_revision
      or installation_row.expires_at <= clock_timestamp()
      or (installation_row.transport = 'android' and installation_row.enrolled_at > campaign_row.started_at)
      or (campaign_row.target <> 'all' and campaign_row.target <> installation_row.target) then return null; end if;
  perform 1 from public.notification_endpoints where endpoint_hash = installation_row.endpoint_hash
    and installation_id = p_installation_id for share;
  if not found then return null; end if;
  return public.notification_campaign_json(campaign_row);
end;
$$;
revoke execute on function public.notification_admit_delivery(text, text, bigint) from public, anon, authenticated;
grant execute on function public.notification_admit_delivery(text, text, bigint) to service_role;

create or replace function public.notification_finish_delivery(p_attempt_id text, p_outcome text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  attempt_row public.notification_attempts%rowtype;
  campaign_id text;
begin
  if p_outcome not in ('accepted', 'failed', 'uncertain', 'skipped') then raise sqlstate 'PT400' using message = 'notification-outcome-invalid'; end if;
  select a.campaign_id into campaign_id from public.notification_attempts a where a.id = p_attempt_id;
  if not found then return; end if;
  perform 1 from public.notification_campaigns where id = campaign_id for update;
  if not found then return; end if;
  select * into attempt_row from public.notification_attempts where id = p_attempt_id for update;
  if not found or attempt_row.finished_at is not null then return; end if;
  update public.notification_attempts set phase = p_outcome, finished_at = clock_timestamp() where id = p_attempt_id;
  update public.notification_campaigns set
    accepted = accepted + case when p_outcome = 'accepted' then 1 else 0 end,
    failed = failed + case when p_outcome = 'failed' then 1 else 0 end,
    skipped = skipped + case when p_outcome = 'skipped' then 1 else 0 end,
    attempted = attempted - case when p_outcome = 'skipped' then 1 else 0 end,
    uncertain = uncertain - case when p_outcome <> 'uncertain' then 1 else 0 end,
    updated_at = clock_timestamp() where id = campaign_id;
end;
$$;
revoke execute on function public.notification_finish_delivery(text, text) from public, anon, authenticated;
grant execute on function public.notification_finish_delivery(text, text) to service_role;

create or replace function public.notification_disable_subscription(p_id text, p_revision bigint, p_endpoint_hash text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  installation_row public.notification_installations%rowtype;
begin
  select * into installation_row from public.notification_installations where id = p_id for update;
  if not found or installation_row.status <> 'active' or installation_row.revision <> p_revision
      or installation_row.endpoint_hash <> p_endpoint_hash then return; end if;
  delete from public.notification_endpoints where installation_id = p_id and endpoint_hash = p_endpoint_hash;
  update public.notification_installations set status = 'disabled', subscription = null, native_ref = null, endpoint_hash = null,
    updated_at = clock_timestamp() where id = p_id;
end;
$$;
revoke execute on function public.notification_disable_subscription(text, bigint, text) from public, anon, authenticated;
grant execute on function public.notification_disable_subscription(text, bigint, text) to service_role;

create or replace function public.notification_cleanup()
returns void language plpgsql security invoker set search_path = '' as $$
declare
  expired_ids text[];
begin
  delete from public.notification_campaigns where id in (
    select id from public.notification_campaigns where expires_at <= clock_timestamp() order by expires_at limit 100 for update skip locked);
  select array_agg(q.id) into expired_ids from (
    select id from public.notification_installations where status = 'active' and expires_at <= clock_timestamp()
      order by expires_at limit 500 for update skip locked
  ) q;
  delete from public.notification_endpoints where installation_id = any(expired_ids);
  update public.notification_installations set status = 'disabled', subscription = null, native_ref = null, endpoint_hash = null,
    updated_at = clock_timestamp() where id = any(expired_ids);
  delete from public.notification_attempts where id in (
    select id from public.notification_attempts where expires_at <= clock_timestamp() order by expires_at limit 500 for update skip locked);
  delete from public.notification_quotas where id in (
    select id from public.notification_quotas where expires_at <= clock_timestamp() order by expires_at limit 1000 for update skip locked);
end;
$$;
revoke execute on function public.notification_cleanup() from public, anon, authenticated;
grant execute on function public.notification_cleanup() to service_role;
