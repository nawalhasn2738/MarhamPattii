# MarhamPattii v2 — secure application foundation

This branch provides a local Next.js application, email/password authentication,
and owned request API foundation. Chat, dispatch/matching, maps, blogs and
checklists are not implemented. No official emergency-service integration exists.

## Run

From `frontend/`, run `npm ci`, then `npm run dev`. Open the printed local URL.
Use `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` to verify.
For a production preview, run `npm run start` after building.

Preserve existing `.env.local`. If configuring a new checkout, copy
`frontend/.env.example` to `frontend/.env.local` and set the public Supabase URL
and publishable key (or legacy anon key). No service-role, Groq or HF credential
is needed for this foundation. Browser and SSR clients use the same public key;
the authenticated user's session supplies database authorization.

## Supabase setup — manual verification required

No live database changes have been made. Before applying
`database/migrations/202611120001_secure_foundation.sql`:

1. Verify the exact target project against the configured URL; use a disposable
   test project first. Inspect existing objects, grants, policies and triggers.
2. Back up the target. This baseline intentionally fails on colliding object names;
   reconcile conflicts rather than using blind `IF NOT EXISTS` skips.
3. Apply the migration in a transaction on the verified test project. Test RLS with
   two ordinary accounts and a trusted test moderator. Do not use a service-role
   client to verify RLS. Configure roles only through trusted SQL/admin tooling.
4. Confirm email/password Auth is enabled. Set Site URL and allowed redirect URLs
   to the actual local origin and `/auth/callback`, then deployment equivalents.
   Confirmation uses the default PKCE code callback; open it in the registration
   browser. Test confirmation-on and confirmation-off configurations.
5. Inspect legacy `requests` table policies and `audio-recordings` bucket separately.
   New code does not read them, but old direct public access may remain deployed.
   Plan a reviewed privacy migration before any public release. Do not make a
   bucket public or weaken RLS to get this foundation running.

New users receive a `user` profile through a database trigger. Existing users are
backfilled as ordinary users. Profile role cannot be inserted/updated by clients;
only display_name can be changed. Responder enrollment is a later task.

The migration adds `community_requests` rather than guessing at the old table.
Legacy rows are not copied, modified or deleted. Reversing the migration removes
new tables/functions/trigger and loses new records: back up first; do not blindly
run a destructive rollback. There is no automatic migration execution.

## API replacement contract

All three endpoints require the SSR session cookies; anonymous calls return 401.
Bearer-only authentication is not supported in this foundation. Cross-origin
browser writes are rejected. Identities and trusted roles are never accepted in
the request body.

- `POST /api/requests`: JSON `{ "incident_type": "other", "note": "..." }`.
  Creates an owned `open` row; returns 201. Only these two keys are accepted.
  Multipart/audio uploads return 415 after authentication. The old Groq/Storage
  pipeline is disabled; no private public audio URLs are generated.
- `GET /api/requests/dashboard`: newest 50 of the caller's own rows, even if the
  caller is a moderator. No global dashboard or audio data is returned.
- `PATCH /api/requests/:id`: JSON `{ "status": "cancelled" }`, for example.
  The database locks and checks ownership/role and transition in one transaction.
  Owners may cancel active requests or resolve accepted/on-the-way requests.
  Trusted moderators/admins may advance states. No responder matching or acceptance
  identity is claimed. `open → accepted → on_the_way → resolved`; accepted may also
  resolve directly. Active states may cancel; terminal states cannot change.
  Unknown/other-owner requests return 404; forbidden actions 403; transitions 409.

Database/configuration failures return 503 without raw upstream errors. Until the
migration is applied and verified, authenticated request operations will not work.

## Verification

`npm test` runs local HTTP security checks against `API_BASE_URL` (default
`http://localhost:3000`) without credentials. These never create production rows.
`database/tests/foundation.sql` is a rollback-only integration test intended for
a disposable Supabase project after applying the migration; it is not auto-run.
It verifies cross-user isolation, role protection and lifecycle behavior.

See [database/tests/README.md](database/tests/README.md) for exact disposable
database commands, two-session concurrency tests, read-only dashboard inspection,
and the real authentication checklist. SQL tests have not been executed.
`npm test` also runs public-config validation tests with synthetic values.
Public configuration rejects malformed URLs and privileged/secret key formats.

Manual Auth checklist: register a test account; confirm email; log in; refresh
dashboard; sign out; verify dashboard redirects; test invalid password/expired
confirmation. Live Auth and database verification require configured test access.

Plain CSS is intentional: it uses existing browser/Next.js capabilities without
adding a styling framework. Cookies are maintained with `@supabase/ssr` and the
Next.js proxy. API handlers and protected pages independently verify the user.
