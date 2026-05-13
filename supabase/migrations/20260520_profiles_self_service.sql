-- Wolds Digital Portal — self-service grants + RLS on public.profiles.
--
-- Symptom this fixes:
--   The portal /account page failed to save with
--   "permission denied for table profiles". The `authenticated` role
--   had no INSERT/UPDATE privilege on the table, and there were no
--   RLS policies covering own-row access either.
--
-- The fix has two layers:
--
--   1.  RLS — only ever let an authenticated user touch their own row.
--   2.  Column-level GRANTs — even when RLS lets them in, they can
--       only ever modify their contact fields. The `is_admin` column
--       is intentionally NOT granted, so a client can never promote
--       themselves; admin assignment stays a `service_role` operation
--       (run by the maintainer via SQL or an admin route).
--
-- Safe to re-run: every statement is idempotent.

------------------------------------------------------------
-- 1.  Enable RLS
------------------------------------------------------------
alter table public.profiles enable row level security;

------------------------------------------------------------
-- 2.  Own-row policies
------------------------------------------------------------
-- SELECT — every signed-in user can read their own row.
drop   policy if exists "profiles_self_select" on public.profiles;
create policy        "profiles_self_select"   on public.profiles
  for select to authenticated
  using (auth.uid() = id);

-- INSERT — used by the AccountForm `upsert` when a user lands without
-- a row (e.g. accounts created before this migration). The WITH CHECK
-- guarantees the id matches the caller, so they can't create rows
-- impersonating someone else.
drop   policy if exists "profiles_self_insert" on public.profiles;
create policy        "profiles_self_insert"   on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- UPDATE — own row only. Column-level grants below take care of
-- preventing is_admin tampering, so the policy itself stays simple.
drop   policy if exists "profiles_self_update" on public.profiles;
create policy        "profiles_self_update"   on public.profiles
  for update to authenticated
  using       (auth.uid() = id)
  with check  (auth.uid() = id);

-- Admin read-everyone — the admin RPCs already use SECURITY DEFINER
-- and don't need a policy, but a few read paths in the app touch
-- profiles directly. Let admins read every row so RLS can stay on.
drop   policy if exists "profiles_admin_select" on public.profiles;
create policy        "profiles_admin_select"   on public.profiles
  for select to authenticated
  using (public.is_current_user_admin());

------------------------------------------------------------
-- 3.  Privilege grants on `authenticated`
------------------------------------------------------------
-- SELECT — whole row (RLS narrows it to own row + admin overrides).
grant select on public.profiles to authenticated;

-- INSERT / UPDATE — explicitly NOT including `is_admin`, so the
-- client can never set or change it. service_role bypasses these
-- grants and can still mutate the column when needed.
grant insert (id, full_name, company_name, phone)
  on    public.profiles
  to    authenticated;

grant update (full_name, company_name, phone)
  on    public.profiles
  to    authenticated;

------------------------------------------------------------
-- 4.  Sanity check (run manually after applying)
------------------------------------------------------------
-- select grantee, privilege_type, column_name
-- from   information_schema.column_privileges
-- where  table_schema = 'public'
--   and  table_name   = 'profiles'
--   and  grantee      = 'authenticated'
-- order  by privilege_type, column_name;
--
-- Expected: INSERT/UPDATE rows for (full_name, company_name, phone),
-- INSERT for (id), and a single table-level SELECT row.
