create or replace function public.admin_project_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  return (select count(*) from public.projects);
end;
$$;

revoke all on function public.admin_project_count() from public;
grant execute on function public.admin_project_count() to authenticated;
