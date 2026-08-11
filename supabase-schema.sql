create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "users read own projects" on public.projects;
drop policy if exists "users create own projects" on public.projects;
drop policy if exists "users update own projects" on public.projects;
drop policy if exists "users delete own projects" on public.projects;

create policy "users read own projects" on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "users create own projects" on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own projects" on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users delete own projects" on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);

create table if not exists public.visitor_counts (
  counter_key text primary key,
  count bigint not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.visitor_counts enable row level security;

drop function if exists public.increment_visitor(text, boolean);

create function public.increment_visitor(p_counter_key text, should_increment boolean default true)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_count bigint;
begin
  if p_counter_key !~ '^visitors-(total|[0-9]{4}-[0-9]{2}-[0-9]{2})$' then
    raise exception 'invalid visitor counter key';
  end if;
  if should_increment then
    insert into public.visitor_counts (counter_key, count)
    values (p_counter_key, 1)
    on conflict (counter_key) do update set count = visitor_counts.count + 1, updated_at = now()
    returning count into current_count;
  else
    select count into current_count from public.visitor_counts where visitor_counts.counter_key = p_counter_key;
  end if;
  return coalesce(current_count, 0);
end;
$$;

revoke all on function public.increment_visitor(text, boolean) from public;
grant execute on function public.increment_visitor(text, boolean) to anon, authenticated;
