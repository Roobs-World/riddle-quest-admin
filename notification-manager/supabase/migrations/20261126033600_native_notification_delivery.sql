-- Apply the native transport policy to all callers, including prior manager deployments.
create or replace function public.notification_subscribe(p_id text, p_origin text, p_target text, p_revision bigint,
  p_locale text, p_subscription jsonb, p_endpoint_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  raise sqlstate 'PT410' using message = 'browser-push-retired';
end;
$$;
revoke execute on function public.notification_subscribe(text, text, text, bigint, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.notification_subscribe(text, text, text, bigint, text, jsonb, text) to service_role;

create or replace function public.notification_activity(p_id text, p_origin text, p_target text, p_locale text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  raise sqlstate 'PT410' using message = 'browser-push-retired';
end;
$$;
revoke execute on function public.notification_activity(text, text, text, text) from public, anon, authenticated;
grant execute on function public.notification_activity(text, text, text, text) to service_role;

create or replace function public.notification_register_firebase(p_id text, p_device_hash text, p_target text, p_revision bigint,
  p_enabled boolean, p_locale text, p_expires_at_ms bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.notification_installations%rowtype;
  now_at timestamptz := clock_timestamp();
  expiry_at timestamptz;
begin
  if p_id !~ '^[a-f0-9]{64}$' or p_device_hash !~ '^[a-f0-9]{64}$' or p_target !~ '^[a-z][a-z0-9-]{0,63}$' or p_target = 'all' or p_enabled is null
      or p_revision < 0 or p_revision > 9007199254740991 or p_expires_at_ms < 0 or p_expires_at_ms > 9007199254740991 then
    raise sqlstate 'PT400' using message = 'firebase-registration-invalid';
  end if;
  if p_enabled then raise sqlstate 'PT410' using message = 'browser-push-retired'; end if;
  expiry_at := now_at + interval '30 days';
  insert into public.notification_installations(id, target, transport, origin, revision, locale, status, expires_at)
    values (p_id, p_target, 'firebase', null, -1, p_locale, 'disabled', expiry_at) on conflict (id) do nothing;
  select * into current_row from public.notification_installations where id = p_id for update;
  if current_row.transport <> 'firebase' then raise sqlstate 'PT403' using message = 'installation-owner-mismatch'; end if;
  if p_revision < current_row.revision then
    return jsonb_build_object('installationId', p_id, 'revision', current_row.revision);
  end if;
  if p_revision = current_row.revision and (current_row.target <> p_target or current_row.status <> 'disabled') then
    raise sqlstate 'PT409' using message = 'installation-revision-conflict';
  end if;
  delete from public.notification_endpoints where installation_id = p_id;
  update public.notification_installations set target = p_target, status = 'disabled', revision = p_revision, locale = p_locale,
    native_ref = null, endpoint_hash = null, updated_at = now_at, expires_at = expiry_at where id = p_id;
  return jsonb_build_object('installationId', p_id, 'revision', p_revision);
end;
$$;
revoke execute on function public.notification_register_firebase(text, text, text, bigint, boolean, text, bigint) from public, anon, authenticated;
grant execute on function public.notification_register_firebase(text, text, text, bigint, boolean, text, bigint) to service_role;

create or replace function public.notification_installation_page(p_campaign_id text, p_cursor text, p_limit integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(q.id order by q.id), '[]'::jsonb) from (
    select i.id from public.notification_installations i join public.notification_campaigns c on c.id = p_campaign_id
    where i.transport = 'android' and i.status = 'active' and i.expires_at > statement_timestamp()
      and c.status = 'sending' and (p_cursor is null or i.id > p_cursor) and (c.target = 'all' or i.target = c.target)
      and i.created_at <= c.started_at and i.enrolled_at <= c.started_at
    order by i.id limit greatest(0, least(p_limit, 50))
  ) q;
$$;
revoke execute on function public.notification_installation_page(text, text, integer) from public, anon, authenticated;
grant execute on function public.notification_installation_page(text, text, integer) to service_role;

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
  if not found or installation_row.transport <> 'android' or installation_row.status <> 'active' or installation_row.expires_at <= now_at
      or installation_row.created_at > coalesce(campaign_row.started_at, now_at)
      or installation_row.enrolled_at > coalesce(campaign_row.started_at, now_at)
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
  if not found or installation_row.transport <> 'android' or installation_row.status <> 'active' or installation_row.revision <> p_revision
      or installation_row.expires_at <= clock_timestamp()
      or installation_row.enrolled_at > campaign_row.started_at
      or (campaign_row.target <> 'all' and campaign_row.target <> installation_row.target) then return null; end if;
  perform 1 from public.notification_endpoints where endpoint_hash = installation_row.endpoint_hash
    and installation_id = p_installation_id for share;
  if not found then return null; end if;
  return public.notification_campaign_json(campaign_row);
end;
$$;
revoke execute on function public.notification_admit_delivery(text, text, bigint) from public, anon, authenticated;
grant execute on function public.notification_admit_delivery(text, text, bigint) to service_role;
