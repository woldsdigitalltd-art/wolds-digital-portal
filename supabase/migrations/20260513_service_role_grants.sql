-- Wolds Digital Portal — restore service_role privileges on the public schema
--
-- Run this once in Supabase Dashboard → SQL Editor.
--
-- Background:
--   By default Supabase grants the `service_role` full access to every
--   table, sequence and function in the `public` schema. On this
--   project those grants had been revoked (or were never applied),
--   which made admin-only operations like POST /api/admin/customers
--   fail with `permission denied for table profiles`.
--
--   This migration restores the standard Supabase grants for the
--   service_role and adds default-privilege rules so any *future*
--   tables/sequences/functions in `public` automatically pick up the
--   same access. The service_role key is only ever used server-side
--   and bypasses RLS, which is exactly what we want for admin work.

------------------------------------------------------------
-- 1. Schema usage
------------------------------------------------------------
grant usage on schema public to service_role;

------------------------------------------------------------
-- 2. Existing objects in `public`
------------------------------------------------------------
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

------------------------------------------------------------
-- 3. Future objects in `public` — same access, no manual re-grants
------------------------------------------------------------
alter default privileges in schema public
  grant all on tables    to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;

------------------------------------------------------------
-- 4. Sanity check — should return >= 1 row showing INSERT/UPDATE
--    on public.profiles for the service_role.
------------------------------------------------------------
-- select grantee, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name   = 'profiles'
--   and grantee      = 'service_role';
