-- Metcash store universe (2026-11-04)
-- Run once in the Supabase SQL editor BEFORE loading the Metcash stores
-- (scripts/import_metcash_universe.mjs) and before deploying the app code.

-- 1. Core-universe flag. Every store already in the table is core (true).
--    The Metcash-only stores are loaded with in_universe = false.
alter table public.stores
  add column if not exists in_universe boolean not null default true;

-- 2. Let every logged-in rep read Unassigned stores and their B&B rows,
--    so they can view them by state and add them to the Cycle Planner.
--    Read-only. Policies are OR'd, so existing access rules are unchanged.
drop policy if exists "read_unassigned_stores" on public.stores;
create policy "read_unassigned_stores" on public.stores
  for select to authenticated using (rep_name = 'Unassigned');

drop policy if exists "read_unassigned_bnb_26wk" on public.bnb_26wk;
create policy "read_unassigned_bnb_26wk" on public.bnb_26wk
  for select to authenticated using (rep_name = 'Unassigned');

drop policy if exists "read_unassigned_bnb_13wk" on public.bnb_13wk;
create policy "read_unassigned_bnb_13wk" on public.bnb_13wk
  for select to authenticated using (rep_name = 'Unassigned');
