create or replace function public.get_visit_counts(p_daily_key text, should_increment boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare daily_count bigint; total_count bigint;
begin
  if p_daily_key !~ '^visitors-[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid daily visitor counter key'; end if;
  insert into public.visitor_counts (counter_key, count) values (p_daily_key, case when should_increment then 1 else 0 end)
  on conflict (counter_key) do update set count = visitor_counts.count + case when should_increment then 1 else 0 end, updated_at = now()
  returning count into daily_count;
  insert into public.visitor_counts (counter_key, count) values ('visitors-total', case when should_increment then 1 else 0 end)
  on conflict (counter_key) do update set count = greatest(visitor_counts.count + case when should_increment then 1 else 0 end, daily_count), updated_at = now()
  returning count into total_count;
  return jsonb_build_object('today',daily_count,'total',total_count);
end;
$$;

revoke all on function public.get_visit_counts(text, boolean) from public;
grant execute on function public.get_visit_counts(text, boolean) to anon, authenticated;
