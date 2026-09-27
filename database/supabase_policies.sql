-- MarhamPattii production RLS and private audio storage policies.
-- Run in the Supabase SQL Editor. API routes use SUPABASE_SERVICE_ROLE_KEY;
-- browsers never receive direct access to healthcare rows or stored audio.

alter table public.requests enable row level security;

-- Remove the earlier hackathon-wide policies.
drop policy if exists "Public insert requests" on public.requests;
drop policy if exists "Public read requests" on public.requests;
drop policy if exists "Public update request status" on public.requests;
drop policy if exists "Provider read requests" on public.requests;
drop policy if exists "Provider update requests" on public.requests;

-- Optional defense in depth for authenticated provider JWTs. The application
-- still routes access through authenticated server APIs and signed audio URLs.
create policy "Provider read requests"
on public.requests for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider');

create policy "Provider update requests"
on public.requests for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'provider');

-- Create the bucket if absent and force it to private if it already exists.
insert into storage.buckets (id, name, public)
values ('audio-recordings', 'audio-recordings', false)
on conflict (id) do update set public = false;

-- Remove all previous direct public object access. Server-side service-role
-- operations bypass RLS; providers receive five-minute signed URLs instead.
drop policy if exists "Public read audio recordings" on storage.objects;
drop policy if exists "Public upload audio recordings" on storage.objects;
drop policy if exists "Provider read audio recordings" on storage.objects;