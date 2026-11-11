-- Disposable/local Supabase ONLY, migrated beforehand. Execute as postgres.
-- psql "$env:TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f database/tests/foundation.sql
-- All fixtures and mutations roll back. UUID collisions fail, never overwrite.
begin;
insert into auth.users(id, email, raw_user_meta_data) values
('10000000-0000-4000-8000-000000000001','foundation-a@example.invalid','{"role":"admin"}'),
('10000000-0000-4000-8000-000000000002','foundation-b@example.invalid','{}'),
('10000000-0000-4000-8000-000000000003','foundation-admin@example.invalid','{}');
do $$ begin
  if (select count(*) from public.profiles where id in (
    '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003') and role='user') <> 3 then
    raise exception 'FAIL: profile creation or untrusted metadata role';
  end if;
end $$;
update public.profiles set role='admin' where id='10000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare request_id uuid; begin
  -- INSERT columns exactly match the application grant (no caller-selected id).
  insert into public.community_requests(owner_id,incident_type,note)
    values (auth.uid(),'other','Synthetic test only') returning id into request_id;
  perform set_config('test.foundation_request_id',request_id::text,true);
  if not exists(select from public.community_requests where id=request_id and owner_id=auth.uid() and status='open') then
    raise exception 'FAIL: own create/read';
  end if;
  update public.profiles set display_name='Test A' where id=auth.uid();
  if not exists(select from public.profiles where id=auth.uid() and display_name='Test A' and role='user') then
    raise exception 'FAIL: own profile edit';
  end if;
  begin
    update public.profiles set role='admin' where id=auth.uid();
    raise exception 'FAIL: self-promotion permitted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.profiles(id,role) values(auth.uid(),'admin');
    raise exception 'FAIL: privileged profile insert';
  exception when insufficient_privilege then null; end;
  begin
    update public.community_requests set owner_id='10000000-0000-4000-8000-000000000002' where id=request_id;
    raise exception 'FAIL: ownership reassignment';
  exception when insufficient_privilege then null; end;
  begin
    update public.community_requests set status='accepted' where id=request_id;
    raise exception 'FAIL: direct status write';
  exception when insufficient_privilege then null; end;
  begin
    perform public.transition_community_request(request_id,'accepted');
    raise exception 'FAIL: ordinary user claimed request';
  exception when insufficient_privilege then null; end;
  begin
    perform public.transition_community_request(request_id,'resolved');
    raise exception 'FAIL: open request resolved';
  exception when check_violation then null; end;
  begin
    perform public.transition_community_request(request_id,'bogus');
    raise exception 'FAIL: unknown state';
  exception when check_violation then null; end;
  begin
    insert into public.community_requests(incident_type,note) values('other','');
    raise exception 'FAIL: empty note';
  exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ declare request_id uuid := current_setting('test.foundation_request_id')::uuid; changed integer; begin
  if exists(select from public.community_requests where id=request_id) then raise exception 'FAIL: cross-user read'; end if;
  if exists(select from public.profiles where id='10000000-0000-4000-8000-000000000001') then raise exception 'FAIL: cross-user profile read'; end if;
  update public.profiles set display_name='Attacker' where id='10000000-0000-4000-8000-000000000001';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: cross-user profile edit'; end if;
  begin
    update public.community_requests set note='Attacker' where id=request_id;
    raise exception 'FAIL: cross-user direct update';
  exception when insufficient_privilege then null; end;
  begin
    perform public.transition_community_request(request_id,'cancelled');
    raise exception 'FAIL: cross-user RPC';
  exception when no_data_found then null; end;
  begin
    insert into public.community_requests(owner_id,incident_type,note)
      values ('10000000-0000-4000-8000-000000000001','other','forged owner');
    raise exception 'FAIL: forged ownership';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform 1 from public.community_requests;
    raise exception 'FAIL: anonymous requests read';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.profiles;
    raise exception 'FAIL: anonymous profiles read';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.community_requests(incident_type,note) values('other','anonymous');
    raise exception 'FAIL: anonymous insert';
  exception when insufficient_privilege then null; end;
  begin
    perform public.transition_community_request(current_setting('test.foundation_request_id')::uuid,'cancelled');
    raise exception 'FAIL: anonymous RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
-- Also test the function's auth guard with authenticated DB role but no JWT UID.
do $$ begin
  begin
    perform public.transition_community_request(current_setting('test.foundation_request_id')::uuid,'cancelled');
    raise exception 'FAIL: missing auth.uid';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select public.transition_community_request(current_setting('test.foundation_request_id')::uuid,'accepted');
do $$ begin
  begin
    perform public.transition_community_request(current_setting('test.foundation_request_id')::uuid,'accepted');
    raise exception 'FAIL: duplicate acceptance';
  exception when check_violation then null; end;
end $$;
select public.transition_community_request(current_setting('test.foundation_request_id')::uuid,'on_the_way');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.transition_community_request(current_setting('test.foundation_request_id')::uuid,'resolved');
do $$ declare item public.community_requests; begin
  begin
    perform public.transition_community_request(current_setting('test.foundation_request_id')::uuid,'cancelled');
    raise exception 'FAIL: terminal request changed';
  exception when check_violation then null; end;
  select * into item from public.community_requests where id=current_setting('test.foundation_request_id')::uuid;
  if item.owner_id <> auth.uid() or item.status <> 'resolved' or item.accepted_at is null or item.on_the_way_at is null
    or item.resolved_at is null or item.updated_at < item.created_at then raise exception 'FAIL: ownership/timestamps'; end if;
  insert into public.community_requests(incident_type,note) values('other','cancel test') returning * into item;
  perform public.transition_community_request(item.id,'cancelled');
  if not exists(select from public.community_requests where id=item.id and cancelled_at is not null and status='cancelled') then
    raise exception 'FAIL: owner cancellation';
  end if;
end $$;
rollback;
-- PASS only if all assertions completed and the final ROLLBACK executed.
