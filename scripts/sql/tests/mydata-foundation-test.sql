-- Manual database test for 20261128100000_mydata_foundation.sql.
-- Run in the Supabase SQL editor AFTER the migration and AFTER fiscal-provision-admin.sql.
-- Runs in a transaction that is rolled back. Each failure raises; each success prints NOTICE 'PASS ...'.
-- NOT executed by the author: no database access was available when this was written.

begin;

do $$
declare
  v_admin uuid := 'a9908a0c-f054-4b2f-b49e-f53d0d8b827f';
  v_id uuid;
  v_src uuid := gen_random_uuid();
begin
  -- 1. The DEMO row cannot be pointed at the LIVE host (and the reverse)
  begin
    update public.mydata_environment_settings set base_url = 'https://mydatapi.aade.gr/myDATA' where environment = 'demo';
    raise exception 'FAIL demo row accepted the live URL';
  exception when check_violation then raise notice 'PASS demo URL locked'; end;
  begin
    update public.mydata_environment_settings set base_url = 'https://mydataapidev.aade.gr' where environment = 'live';
    raise exception 'FAIL live row accepted the demo URL';
  exception when check_violation then raise notice 'PASS live URL locked'; end;

  -- 2. LIVE cannot be activated without the gate, and the gate needs every prerequisite
  begin
    perform public.mydata_set_active_environment('live', v_admin);
    raise exception 'FAIL live activated without enable_live';
  exception when sqlstate '23514' then raise notice 'PASS live blocked without gate'; end;
  begin
    perform public.mydata_enable_live(v_admin);
    raise exception 'FAIL live enabled with missing prerequisites';
  exception when sqlstate '23514' then raise notice 'PASS enable_live refuses incomplete setup'; end;

  -- 3. A non-admin actor is refused by every RPC
  begin
    perform public.mydata_disable_live(gen_random_uuid());
    raise exception 'FAIL non-admin actor accepted';
  exception when sqlstate '42501' then raise notice 'PASS non-admin actor refused'; end;

  -- 4. A rule cannot be confirmed while incomplete
  perform public.mydata_save_product_rule('demo', 'BOOK', null, null, null, null, null, null, null, null, v_admin);
  begin
    perform public.mydata_confirm_product_rule('demo', 'BOOK', v_admin);
    raise exception 'FAIL incomplete rule confirmed';
  exception when check_violation then raise notice 'PASS incomplete rule cannot be confirmed'; end;

  -- 5. Invoice constraints: one per source, transmitted needs MARK+UID, fiscal fields immutable, append-only attempts
  insert into public.mydata_invoices (environment, scenario, source_type, source_id, issuer_vat_number, series, aa,
    issue_date, invoice_type, net_cents, vat_cents, gross_cents)
  values ('demo', 'BOOK', 'book_order', v_src, '999999999', 'T', 1, current_date, '11.2', 8065, 1935, 10000)
  returning id into v_id;
  begin
    insert into public.mydata_invoices (environment, scenario, source_type, source_id, issuer_vat_number, series, aa,
      issue_date, invoice_type, net_cents, vat_cents, gross_cents)
    values ('demo', 'BOOK', 'book_order', v_src, '999999999', 'T', 2, current_date, '11.2', 8065, 1935, 10000);
    raise exception 'FAIL duplicate source accepted';
  exception when unique_violation then raise notice 'PASS one invoice per source'; end;

  update public.mydata_invoices set status = 'submitting' where id = v_id;
  begin
    update public.mydata_invoices set status = 'transmitted' where id = v_id;
    raise exception 'FAIL transmitted without MARK/UID';
  exception when check_violation then raise notice 'PASS transmitted needs MARK and UID'; end;
  begin
    update public.mydata_invoices set gross_cents = 1, net_cents = 1, vat_cents = 0 where id = v_id;
    raise exception 'FAIL fiscal fields changed';
  exception when sqlstate '23514' then raise notice 'PASS fiscal fields immutable'; end;
  update public.mydata_invoices set status = 'transmitted', mark = 400000000000001, uid = 'U1' where id = v_id;
  begin
    update public.mydata_invoices set status = 'pending' where id = v_id;
    raise exception 'FAIL transmitted went back to pending';
  exception when sqlstate '23514' then raise notice 'PASS transmitted is terminal (except cancel)'; end;
  begin
    delete from public.mydata_invoices where id = v_id;
    raise exception 'FAIL invoice deleted';
  exception when sqlstate '42501' then raise notice 'PASS invoices cannot be deleted'; end;

  -- 6. Numbering is sequential and atomic
  if public.mydata_allocate_aa('demo', '999999999', 'SEQ') <> 1 or public.mydata_allocate_aa('demo', '999999999', 'SEQ') <> 2 then
    raise exception 'FAIL numbering not sequential';
  end if;
  raise notice 'PASS numbering sequential';

  -- 7. API roles cannot read credentials or write config
  set local role authenticated;
  begin
    perform * from public.mydata_get_credentials('demo');
    raise exception 'FAIL authenticated read credentials';
  exception when insufficient_privilege then raise notice 'PASS authenticated cannot call mydata_get_credentials'; end;
  begin
    update public.mydata_config set live_enabled = true;
    raise exception 'FAIL authenticated updated config';
  exception when insufficient_privilege then raise notice 'PASS authenticated cannot update config'; end;
  reset role;
end $$;

rollback;
