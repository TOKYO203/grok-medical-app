-- Introspection des trois tables non versionnées (profiles, progressions, licences).
-- Lecture seule. Coller chaque bloc dans l'éditeur SQL Supabase.
-- Objectif : reconstituer une migration fidèle (colonnes, contraintes, index, policies).

-- 1. Colonnes
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'progressions', 'licences')
order by table_name, ordinal_position;

-- 2. Contraintes (clés primaires, étrangères, uniques, CHECK)
select conrelid::regclass as table_name, conname, contype,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
  and conrelid::regclass::text in ('profiles', 'progressions', 'licences')
order by table_name, conname;

-- 3. Index
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('profiles', 'progressions', 'licences')
order by tablename, indexname;

-- 4. Triggers
select event_object_table as table_name, trigger_name, action_timing, event_manipulation,
       action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('profiles', 'progressions', 'licences')
order by table_name, trigger_name;

-- 5. RLS et policies
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles', 'progressions', 'licences');

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'progressions', 'licences');

-- 6. Grants accordés aux rôles clients
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'progressions', 'licences')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
