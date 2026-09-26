# Vercel deployment notes

MarhamPattii's Next.js app lives inside `frontend/`. In Vercel, set:

- Root Directory: `frontend`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`

Required production environment variables are documented in the root `.env.example` file.

## Important AI pipeline note

The current `/api/requests` route invokes the local Python ASR pipeline with `child_process`. This works for local demos and servers where Python, the Balti Whisper model, and `ai-service/` are available on disk.

For a standard Vercel serverless deployment, move the Python ASR pipeline to a hosted Python service or container, then have `/api/requests` call that service over HTTP. The Supabase dashboard routes and provider status updates are serverless-ready.

## Serverless duration

The audio request route declares `maxDuration` because ASR/model inference can take longer than a normal API request. Confirm your Vercel plan supports the configured timeout, or deploy the ASR pipeline separately.