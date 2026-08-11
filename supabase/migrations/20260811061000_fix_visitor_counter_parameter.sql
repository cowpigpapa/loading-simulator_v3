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
