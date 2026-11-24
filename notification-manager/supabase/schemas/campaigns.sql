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
      and i.created_at <= c.started_at
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
