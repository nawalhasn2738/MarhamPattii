# Database and authentication verification

## Safety and current result

No migration or SQL test has been applied/run by this task. No local psql,
Supabase CLI, Docker, or confirmed disposable database was available. SQL review
is not execution evidence. Do not point these commands at the existing live
Supabase project. The baseline migration remains prepared and unapplied.

## Read-only Supabase dashboard inspection

1. Verify the project name and reference in Project Settings against the URL used
   locally. Do not paste or print keys. Never use a secret/service-role key as a
   NEXT_PUBLIC variable. Settings/API Keys supplies the publishable key.
2. In Authentication / Sign In / Providers, inspect Email enablement, password
   requirements, confirmation settings and signup availability.
3. In Authentication / URL Configuration, inspect Site URL and redirect allowlist.
   The intended local callback is `http://localhost:3100/auth/callback` for the
   preview below (use port 3000 for the usual dev server). Deployment origins
   must be explicit; do not introduce broad wildcards.
4. Inspect the Confirm Signup email template. The default ConfirmationURL flow
   is compatible with the current PKCE code callback. A custom token_hash-only
   link is not supported by this callback. Do not change the live template here.
5. Inspect tables/policies/grants for profiles, community_requests, legacy requests
   and storage.objects. Existing legacy public policies/buckets are not secured
   merely by this new application. Do not delete or alter them in this task.
6. Do not run the prepared migration in the live project's SQL editor. Any future
   application requires a separately reviewed target/backup/migration plan.

## Local/disposable SQL setup

Use a separate local Supabase stack with its standard auth schema/roles. If
needed on your machine: install Docker, Supabase CLI and PostgreSQL psql, then
run `supabase init` and `supabase start` in a separate empty test directory, not
inside this repository. Set TEST_DATABASE_URL in your terminal to that local
database's postgres connection string. Do not store it in a tracked file.

From the repository root, after verifying the URL is the disposable/local DB:

```powershell
psql "$env:TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f database/migrations/202611120001_secure_foundation.sql
psql "$env:TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f database/tests/foundation.sql
```

Expected: all assertions finish, followed by ROLLBACK, exit code 0. Any SQL error
is a failure; ON_ERROR_STOP and disconnection roll back the transaction. The
tests switch to authenticated/anon roles and simulate auth.uid using JWT claims;
they do not prove password login or email delivery. No service-role RLS bypass
is used for the assertions. Fixtures are rolled back; fixed-user UUID collisions
fail without overwriting existing accounts.

Coverage: trigger-created profiles ignoring user-supplied roles; own profile
name update; role insert/update denial; own request insert/read; cross-user
read/direct update/RPC denial; anonymous tables/insert/RPC denial; missing uid;
forged ownership and ownership reassignment denial; direct status-write denial;
invalid and duplicate transitions; valid lifecycle, cancellation, timestamps.

## Two-session concurrency test (disposable environment ONLY)

The setup deliberately commits new synthetic fixtures, because independent
sessions cannot see rollback-only fixtures. It never overwrites/deletes existing
rows. Run once per fresh disposable database; dispose of that test environment
afterwards rather than running cleanup against an existing project.

```powershell
psql "$env:TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f database/tests/concurrency-setup.sql
```

Open two terminals in the repository root, each with TEST_DATABASE_URL set to the
same disposable DB. Start A, then start B during A's ten-second lock hold:

```powershell
# Terminal A
psql "$env:TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v request_id=40000000-0000-4000-8000-000000000001 -v next_status=accepted -f database/tests/concurrency-a.sql
# Terminal B
psql "$env:TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v request_id=40000000-0000-4000-8000-000000000001 -v next_status=accepted -f database/tests/concurrency-b.sql
```

Expected: B blocks until A commits, then prints PASS for check_violation (23514).
Only A's acceptance commits. B succeeding or lock-timeout is a failure.

Repeat on the second fixture to test conflicting terminal transitions:

```powershell
# Terminal A
psql "$env:TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v request_id=40000000-0000-4000-8000-000000000002 -v next_status=resolved -f database/tests/concurrency-a.sql
# Terminal B, while A holds its lock
psql "$env:TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -v request_id=40000000-0000-4000-8000-000000000002 -v next_status=cancelled -f database/tests/concurrency-b.sql
```

Expected final states are accepted for fixture 1 and resolved for fixture 2.
Check as postgres with SELECT id,status FROM public.community_requests WHERE
id IN ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002').
This tests competing trusted-role status changes, NOT responder assignment.
Responder identity/matching/exclusive claims are not implemented yet.

## Real authentication and API checklist (still requires manual execution)

Point a separate local checkout/configuration at the disposable Supabase stack;
never overwrite the current environment files. Configure its Email Auth and exact
callback allowlist there. For local email, open the local mail viewer URL printed
by `supabase status` (do not assume a fixed port).

1. Register A in one browser profile. Confirm no role selector exists. With email
   confirmation enabled, open the email in that same browser and reach dashboard.
2. Refresh dashboard and a new tab; verify session persists. Sign out; refresh and
   visit dashboard again; expect login redirect and API 401.
3. Invalid password gives a friendly error. Expired/reused callback reaches
   /auth/error. Missing callback code is testable locally without any account.
4. Repeat with confirmation disabled in the disposable setup; signup should
   directly open dashboard. Do not change the live project's settings.
5. Register B in a separate browser profile. With each session, use same-origin
   browser fetch to POST /api/requests with JSON incident_type/note; expect 201.
   GET /api/requests/dashboard must return only that user's rows.
6. B PATCHes A's id with cancelled: expect 404. A cancels its open request:
   expect 200, then any further transition: 409. A attempting accepted: 403.
   Supplying owner_id/role/status at creation: 400. Multipart creation: 415.
7. Remove/corrupt session cookies in the disposable browser: private APIs 401,
   dashboard redirects. For refresh expiry, test a short session lifetime only
   on the disposable stack; observe refresh cookie and subsequent getUser success.
8. Test a separate process with no public env, malformed URL, wrong-project anon
   key, invalid public key and accidentally supplied secret key. Never print
   credentials. Forms must report an error; private access must fail closed.
   Unit config tests cover local validation, not actual wrong-project rejection.

The current UI has no request API caller, so no request error component can be
verified yet. Tests and the README are the only callers/contracts found; no old
audio/Balti flow is invoked by application source.
