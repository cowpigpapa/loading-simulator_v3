create table if not exists public.admin_users (
  email text primary key check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

insert into public.admin_users (email) values ('juan.hjlee@gmail.com') on conflict do nothing;

alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
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

create policy "admins read access stats" on public.user_access
for select to authenticated using ((select public.is_admin()));

create policy "admins read admin list" on public.admin_users
for select to authenticated using ((select public.is_admin()));

create or replace function public.record_user_access()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or current_email = '' then
    raise exception 'authentication required';
  end if;
  insert into public.user_access (user_id, email)
  values (auth.uid(), current_email)
  on conflict (user_id) do update
  set email = excluded.email,
      last_seen_at = now(),
      visit_count = user_access.visit_count + 1;
end;
$$;

create or replace function public.grant_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare normalized_email text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'admin required'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'invalid email'; end if;
  insert into public.admin_users (email, created_by)
  values (normalized_email, auth.uid())
  on conflict (email) do nothing;
end;
$$;

create or replace function public.revoke_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
