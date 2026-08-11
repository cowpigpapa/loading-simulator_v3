create table if not exists public.visitor_counts (
  counter_key text primary key,
  count bigint not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.visitor_counts enable row level security;

create or replace function public.increment_visitor(counter_key text, should_increment boolean default true)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare current_count bigint;
begin
  if counter_key !~ '^visitors-(total|[0-9]{4}-[0-9]{2}-[0-9]{2})$' then
    raise exception 'invalid visitor counter key';
  end if;
  if should_increment then
    insert into public.visitor_counts (counter_key, count)
    values (counter_key, 1)
    on conflict (counter_key) do update set count = visitor_counts.count + 1, updated_at = now()
    returning count into current_count;
  else
    select count into current_count from public.visitor_counts where visitor_counts.counter_key = increment_visitor.counter_key;
  end if;
  return coalesce(current_count, 0);
end;
$$;

revoke all on function public.increment_visitor(text, boolean) from public;
grant execute on function public.increment_visitor(text, boolean) to anon, authenticated;
