-- Opaque consent-order tombstones stay after expiry so delayed requests cannot reverse an opt-out.
-- These rows are never part of the campaign dispatcher audience.
create table public.notification_jest_registrations (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  recipient_hash text not null check (recipient_hash ~ '^[a-f0-9]{64}$'),
  revision bigint not null check (revision between 0 and 9007199254740991),
  enabled boolean not null,
  locale text not null check (locale = 'en'),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.notification_jest_registrations enable row level security;
revoke all on public.notification_jest_registrations from public, anon, authenticated;
grant all on public.notification_jest_registrations to service_role;

create or replace function public.notification_register_jest(p_id text, p_recipient_hash text, p_revision bigint,
  p_enabled boolean, p_locale text, p_expires_at_ms bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.notification_jest_registrations%rowtype;
  now_at timestamptz := clock_timestamp();
  expiry_at timestamptz;
begin
  if p_id is null or p_recipient_hash is null or p_revision is null or p_enabled is null or p_locale is distinct from 'en'
      or p_expires_at_ms is null or p_id !~ '^[a-f0-9]{64}$' or p_recipient_hash !~ '^[a-f0-9]{64}$'
      or p_revision < 0 or p_revision > 9007199254740991 or p_expires_at_ms < 0 or p_expires_at_ms > 9007199254740991 then
    raise sqlstate 'PT400' using message = 'jest-registration-invalid';
  end if;
  if p_enabled and p_expires_at_ms <= floor(extract(epoch from now_at) * 1000)::bigint then
    raise sqlstate 'PT400' using message = 'jest-registration-expired';
  end if;
  expiry_at := case when p_enabled then to_timestamp(least(p_expires_at_ms,
    floor(extract(epoch from now_at + interval '30 days') * 1000)::bigint)::numeric / 1000)
    else to_timestamp(0) end;
  insert into public.notification_jest_registrations(id, recipient_hash, revision, enabled, locale, expires_at)
    values (p_id, p_recipient_hash, p_revision, p_enabled, p_locale, expiry_at) on conflict (id) do nothing;
  select * into current_row from public.notification_jest_registrations where id = p_id for update;
  if current_row.recipient_hash <> p_recipient_hash then
    raise sqlstate 'PT403' using message = 'jest-registration-owner-mismatch';
  end if;
  if p_revision < current_row.revision or (p_revision = current_row.revision and p_enabled <> current_row.enabled) then
    raise sqlstate 'PT409' using message = 'jest-registration-revision-conflict';
  end if;
  if p_revision = current_row.revision and p_enabled then expiry_at := greatest(expiry_at, current_row.expires_at); end if;
  update public.notification_jest_registrations set revision = p_revision, enabled = p_enabled, locale = p_locale,
    expires_at = expiry_at, updated_at = now_at where id = p_id;
  return jsonb_build_object('installationId', p_id, 'revision', p_revision, 'enabled', p_enabled,
    'expiresAtMs', floor(extract(epoch from expiry_at) * 1000)::bigint);
end;
$$;
revoke execute on function public.notification_register_jest(text, text, bigint, boolean, text, bigint) from public, anon, authenticated;
grant execute on function public.notification_register_jest(text, text, bigint, boolean, text, bigint) to service_role;
