-- Start first, then start B while this session is holding its row lock.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select public.transition_community_request(:'request_id'::uuid, :'next_status');
select pg_sleep(10);
commit;
