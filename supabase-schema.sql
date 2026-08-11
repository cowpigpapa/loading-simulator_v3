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
