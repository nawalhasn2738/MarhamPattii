-- Supabase policies for the MarhamPattii hackathon MVP.
--
-- Run this in the Supabase SQL Editor if the API returns:
--   "new row violates row-level security policy"
--
-- Safer production option:
--   Add SUPABASE_SERVICE_ROLE_KEY to frontend/.env.local and keep uploads server-side.
--   Service-role keys must never be exposed to browser/client code.

-- Public read access is expected because the bucket is used with getPublicUrl().
drop policy if exists "Public read audio recordings" on storage.objects;
create policy "Public read audio recordings"
on storage.objects
for select
to anon
using (bucket_id = 'audio-recordings');

-- Hackathon-friendly upload policy for unauthenticated local testing.
-- This allows the publishable Supabase key to upload files into audio-recordings.
drop policy if exists "Public upload audio recordings" on storage.objects;
create policy "Public upload audio recordings"
on storage.objects
for insert
to anon
with check (bucket_id = 'audio-recordings');

-- If RLS is enabled on public.requests, these policies allow the demo API to
-- insert and read requests using the publishable key.
drop policy if exists "Public insert requests" on public.requests;
create policy "Public insert requests"
on public.requests
for insert
to anon
with check (true);

drop policy if exists "Public read requests" on public.requests;
create policy "Public read requests"
on public.requests
for select
to anon
using (true);

drop policy if exists "Public update request status" on public.requests;
create policy "Public update request status"
on public.requests
for update
to anon
using (true)
with check (true);