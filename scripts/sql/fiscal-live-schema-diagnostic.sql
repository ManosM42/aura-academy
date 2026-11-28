-- READ-ONLY diagnostic. Paste into the Supabase SQL editor and compare with the repo migrations.
-- Changes nothing.

-- 1. fiscal functions: live definition, owner, security mode, privileges
select p.oid::regprocedure as fn, pg_get_functiondef(p.oid) as definition,
       p.prosecdef as security_definer, pg_get_userbyid(p.proowner) as owner, p.proacl as acl
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'fiscal%' order by p.proname;

-- 2. fiscal_admins: columns and row count
select column_name, data_type, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'fiscal_admins' order by ordinal_position;
select count(*) as fiscal_admins_rows from public.fiscal_admins;

-- 3. fiscal tables that exist live, with columns
select table_name, string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) as columns
from information_schema.columns where table_schema = 'public' and table_name like 'fiscal%'
group by table_name order by table_name;

-- 4. RLS state and policies
select c.relname, c.relrowsecurity as rls_enabled from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'fiscal%' order by 1;
select tablename, policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'public' and tablename like 'fiscal%' order by 1, 2;

-- 5. anon / authenticated privileges on fiscal tables
select table_name, grantee, string_agg(privilege_type, ', ') as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name like 'fiscal%' and grantee in ('anon', 'authenticated')
group by 1, 2 order by 1, 2;

-- 6. enum types
select t.typname, string_agg(e.enumlabel, ', ' order by e.enumsortorder) as labels
from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public' and t.typname like 'fiscal%' group by 1 order by 1;

-- 7. profiles.role: does it exist, and who can change it?
select column_name, data_type, column_default from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'role';
select policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'profiles' order by 1;
select tgname, pg_get_triggerdef(oid) from pg_trigger
where tgrelid = 'public.profiles'::regclass and not tgisinternal;

-- 8. applied migration history
select version, name from supabase_migrations.schema_migrations order by version;
