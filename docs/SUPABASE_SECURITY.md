# Supabase security setup

## Provider authentication

Provider API routes require a valid Supabase access token in `Authorization: Bearer <token>`. Access is granted only when the verified user's server-controlled `app_metadata` contains `{ "role": "provider" }`.

Never authorize with `user_metadata` or a frontend role header. Assign the role from a trusted environment with the Supabase Admin API:

```ts
await supabaseAdmin.auth.admin.updateUserById(userId, {
  app_metadata: { role: "provider" },
});
```

The provider must refresh their session after assignment so the JWT contains the role. The existing frontend role selector is navigation state only and does not grant API access.

## Private bucket and RLS

Run `database/supabase_policies.sql` in the Supabase SQL Editor. It enables request RLS, removes anonymous healthcare-data policies, adds provider policies, converts `audio-recordings` to private, and removes anonymous Storage access.

Backend routes require `SUPABASE_SERVICE_ROLE_KEY`. Never expose it in browser code. Authorized provider responses contain five-minute signed audio URLs; database rows store private object paths rather than permanent public URLs.

Older rows containing former public URLs are supported: the API extracts their object path and creates a signed URL after authorization.