-- PREPARED ONLY: verify the project, backup, inspect existing policies and test
-- in a disposable Supabase project before applying. Existing requests/storage
-- are deliberately untouched: their deployed schema and ownership are unknown.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  role text not null default 'user' check (role in ('user','responder','moderator','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_edit_name on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create function public.initialize_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$;
revoke all on function public.initialize_profile() from public, anon, authenticated;
create trigger initialize_community_profile after insert on auth.users
for each row execute function public.initialize_profile();
-- Backfill existing identities without importing user-controlled role metadata.
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

create table public.community_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  incident_type text not null check (char_length(btrim(incident_type)) between 1 and 80),
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  status text not null default 'open' check (status in ('open','accepted','on_the_way','resolved','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  on_the_way_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz
);
create index community_requests_owner_created on public.community_requests(owner_id, created_at desc);
create index community_requests_status_created on public.community_requests(status, created_at desc);
alter table public.community_requests enable row level security;
revoke all on public.community_requests from public, anon, authenticated;
grant select on public.community_requests to authenticated;
grant insert (owner_id, incident_type, note) on public.community_requests to authenticated;
create policy community_requests_read_own on public.community_requests for select to authenticated using (owner_id = auth.uid());
create policy community_requests_create_own on public.community_requests for insert to authenticated
with check (owner_id = auth.uid() and status = 'open');
-- No direct UPDATE/DELETE grant. All state writes go through the locked RPC.
create function public.transition_community_request(request_id uuid, next_status text)
returns public.community_requests language plpgsql security definer set search_path = '' as $$
declare
  item public.community_requests;
  actor uuid := auth.uid();
  actor_role text;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select role into actor_role from public.profiles where id = actor;
  -- Filter before locking: unrelated callers must not lock another user's row.
  select * into item from public.community_requests
  where id = request_id and (owner_id = actor or coalesce(actor_role,'') in ('moderator','admin'))
  for update;
  -- Return the same not-found response for missing and other users' requests.
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if next_status is null or next_status not in ('accepted','on_the_way','resolved','cancelled') then
    raise exception 'Invalid status' using errcode = '23514';
  end if;
  if coalesce(actor_role,'') not in ('moderator','admin') and next_status not in ('cancelled','resolved') then
    raise exception 'Trusted role required' using errcode = '42501';
  end if;
  if not (
    (item.status = 'open' and next_status in ('accepted','cancelled')) or
    (item.status = 'accepted' and next_status in ('on_the_way','resolved','cancelled')) or
    (item.status = 'on_the_way' and next_status in ('resolved','cancelled'))
  ) then raise exception 'Invalid transition' using errcode = '23514'; end if;
  update public.community_requests set
    status = next_status, updated_at = now(),
    accepted_at = case when next_status = 'accepted' then now() else accepted_at end,
    on_the_way_at = case when next_status = 'on_the_way' then now() else on_the_way_at end,
    resolved_at = case when next_status = 'resolved' then now() else resolved_at end,
    cancelled_at = case when next_status = 'cancelled' then now() else cancelled_at end
  where id = request_id returning * into item;
  return item;
end;
$$;
revoke all on function public.transition_community_request(uuid,text) from public, anon;
grant execute on function public.transition_community_request(uuid,text) to authenticated;
commit;
