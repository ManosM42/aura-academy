-- Provision a Fiscal Admin. Run MANUALLY in the Supabase SQL editor (runs as postgres).
-- Idempotent. Prerequisite: 20261128090000_fiscal_authz_corrective.sql is applied.
-- This is the only supported way to add a fiscal admin; the API cannot write public.fiscal_admins.

do $$
declare
  v_user_id uuid := 'a9908a0c-f054-4b2f-b49e-f53d0d8b827f';
  v_email   text;
  v_profile_role text;
begin
  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then
    raise exception 'No auth.users row for %. Refusing to provision an unknown user.', v_user_id;
  end if;

  -- Sanity check only (NOT the authorization source).
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    execute 'select to_jsonb(p) ->> ''role'' from public.profiles p where p.id = $1'
      into v_profile_role using v_user_id;
    if v_profile_role is distinct from 'admin' then
      raise exception 'User % has profiles.role = % (expected admin). Refusing to provision.',
        v_user_id, coalesce(v_profile_role, 'NULL');
    end if;
  end if;

  insert into public.fiscal_admins (user_id, note)
  values (v_user_id, 'Provisioned manually via scripts/sql/fiscal-provision-admin.sql')
  on conflict (user_id) do nothing;
end $$;

select a.user_id, u.email, a.created_at
from public.fiscal_admins a join auth.users u on u.id = a.user_id order by a.created_at;

-- To revoke: delete from public.fiscal_admins where user_id = '<uuid>';
