alter table public.user_access
  add column if not exists simulation_count bigint not null default 0 check (simulation_count >= 0),
  add column if not exists last_simulated_at timestamptz;

create or replace function public.record_simulation()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or current_email = '' then raise exception 'authentication required'; end if;
  insert into public.user_access (user_id, email, simulation_count, last_simulated_at)
  values (auth.uid(), current_email, 1, now())
  on conflict (user_id) do update
  set email = excluded.email,
      simulation_count = user_access.simulation_count + 1,
      last_simulated_at = now();
end;
$$;

create or replace function public.admin_user_stats()
returns table (
  email text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  visit_count bigint,
  simulation_count bigint,
  last_simulated_at timestamptz,
  project_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  return query
  select ua.email, ua.first_seen_at, ua.last_seen_at, ua.visit_count,
         ua.simulation_count, ua.last_simulated_at, count(p.id)::bigint
  from public.user_access ua
  left join public.projects p on p.user_id = ua.user_id
  group by ua.user_id, ua.email, ua.first_seen_at, ua.last_seen_at,
           ua.visit_count, ua.simulation_count, ua.last_simulated_at
  order by ua.last_seen_at desc;
end;
$$;

revoke all on function public.record_simulation() from public;
revoke all on function public.admin_user_stats() from public;
grant execute on function public.record_simulation() to authenticated;
grant execute on function public.admin_user_stats() to authenticated;
