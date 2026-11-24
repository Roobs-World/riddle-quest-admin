-- This provider-owned event trigger needs no browser execution privileges.
do $permissions$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure('public.rls_auto_enable()')
      and p.prorettype = 'pg_catalog.event_trigger'::pg_catalog.regtype
      and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$permissions$;
