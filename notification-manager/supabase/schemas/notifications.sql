create table public.notification_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.notification_installations (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  target text not null check (target ~ '^[a-z][a-z0-9-]{0,63}$'),
  transport text not null default 'web-push' check (transport in ('web-push', 'android', 'firebase')),
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
    or (transport = 'firebase' and origin is null and target <> 'all' and subscription is null)
  ),
  constraint notification_installation_state check (
    (status = 'active' and endpoint_hash is not null and endpoint_hash ~ '^[a-f0-9]{64}$' and enrolled_at is not null
      and (transport = 'web-push' and subscription is not null or transport in ('android', 'firebase') and native_ref is not null))
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
