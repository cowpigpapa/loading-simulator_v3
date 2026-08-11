import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../supabase/migrations/20260811070000_add_admin_access_stats.sql',import.meta.url),'utf8');

test('admin access is enforced by Supabase and seeds the owner email',()=>{
  assert.match(sql,/juan\.hjlee@gmail\.com/);
  assert.match(sql,/alter table public\.admin_users enable row level security/i);
  assert.match(sql,/alter table public\.user_access enable row level security/i);
  assert.match(sql,/security definer[\s\S]+if not public\.is_admin\(\)/i);
  assert.match(sql,/cannot revoke yourself/i);
});
