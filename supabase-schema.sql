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

create table if not exists public.admin_users (
  email text primary key check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
insert into public.admin_users (email) values ('juan.hjlee@gmail.com') on conflict do nothing;
alter table public.admin_users enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admin_users where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create table if not exists public.user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  visit_count bigint not null default 1 check (visit_count > 0)
);
alter table public.user_access enable row level security;
drop policy if exists "admins read access stats" on public.user_access;
drop policy if exists "admins read admin list" on public.admin_users;
create policy "admins read access stats" on public.user_access for select to authenticated using ((select public.is_admin()));
create policy "admins read admin list" on public.admin_users for select to authenticated using ((select public.is_admin()));

create or replace function public.record_user_access() returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or current_email = '' then raise exception 'authentication required'; end if;
  insert into public.user_access (user_id, email) values (auth.uid(), current_email)
  on conflict (user_id) do update set email = excluded.email, last_seen_at = now(), visit_count = user_access.visit_count + 1;
end;
$$;

create or replace function public.grant_admin(p_email text) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare normalized_email text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid email'; end if;
  insert into public.admin_users (email, created_by) values (normalized_email, auth.uid()) on conflict (email) do nothing;
end;
$$;

create or replace function public.revoke_admin(p_email text) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare normalized_email text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if normalized_email = lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'cannot revoke yourself'; end if;
  delete from public.admin_users where email = normalized_email;
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.record_user_access() from public;
revoke all on function public.grant_admin(text) from public;
revoke all on function public.revoke_admin(text) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.record_user_access() to authenticated;
grant execute on function public.grant_admin(text) to authenticated;
grant execute on function public.revoke_admin(text) to authenticated;
grant select on public.user_access to authenticated;
grant select on public.admin_users to authenticated;
