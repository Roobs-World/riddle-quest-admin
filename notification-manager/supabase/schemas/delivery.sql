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
