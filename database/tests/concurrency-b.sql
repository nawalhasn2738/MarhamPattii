begin;
set local lock_timeout = '20s';
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select set_config('test.request_id', :'request_id', true);
select set_config('test.next_status', :'next_status', true);
do $$ begin
  begin
    perform public.transition_community_request(current_setting('test.request_id')::uuid,current_setting('test.next_status'));
    raise exception 'FAIL: conflicting second transition succeeded';
  exception when check_violation then
    raise notice 'PASS: conflicting second transition rejected';
  end;
end $$;
rollback;
