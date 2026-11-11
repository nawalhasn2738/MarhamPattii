-- ONLY on a disposable/local database. These synthetic fixtures must be committed
-- so two independent sessions can see them. No existing rows are overwritten.
begin;
insert into auth.users(id,email) values
('30000000-0000-4000-8000-000000000001','race-a@example.invalid'),
('30000000-0000-4000-8000-000000000002','race-b@example.invalid');
update public.profiles set role='moderator' where id in (
'30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002');
insert into public.community_requests(id,owner_id,incident_type,note,status,accepted_at) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','other','Synthetic duplicate acceptance test','open',null),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','other','Synthetic conflicting terminal transitions','accepted',now());
commit;
