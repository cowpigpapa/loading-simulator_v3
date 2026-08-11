import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../supabase/migrations/20260811070000_add_admin_access_stats.sql',import.meta.url),'utf8');
const projectCountSql=await readFile(new URL('../supabase/migrations/20260811080000_add_admin_project_count.sql',import.meta.url),'utf8');
const userStatsSql=await readFile(new URL('../supabase/migrations/20260811081000_add_user_simulation_stats.sql',import.meta.url),'utf8');

test('admin access is enforced by Supabase and seeds the owner email',()=>{
  assert.match(sql,/juan\.hjlee@gmail\.com/);
  assert.match(sql,/alter table public\.admin_users enable row level security/i);
  assert.match(sql,/alter table public\.user_access enable row level security/i);
  assert.match(sql,/security definer[\s\S]+if not public\.is_admin\(\)/i);
  assert.match(sql,/cannot revoke yourself/i);
});

test('saved project count is restricted to admins',()=>{
  assert.match(projectCountSql,/if not public\.is_admin\(\)/i);
  assert.match(projectCountSql,/select count\(\*\) from public\.projects/i);
  assert.match(projectCountSql,/grant execute on function public\.admin_project_count\(\) to authenticated/i);
});

test('simulation and per-user project stats are server-side and admin protected',()=>{
  assert.match(userStatsSql,/simulation_count bigint not null default 0/i);
  assert.match(userStatsSql,/create or replace function public\.record_simulation\(\)/i);
  assert.match(userStatsSql,/create or replace function public\.admin_user_stats\(\)/i);
  assert.match(userStatsSql,/if not public\.is_admin\(\)/i);
  assert.match(userStatsSql,/left join public\.projects p on p\.user_id = ua\.user_id/i);
});
