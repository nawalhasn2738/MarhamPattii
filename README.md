# MarhamPattii

MarhamPattii is a voice-first Balti healthcare communication bridge that converts patient voice messages into structured provider requests while preserving the original audio for review and follow-up.

## One-line pitch

Patients speak naturally in Balti, and MarhamPattii turns that audio into an actionable healthcare request for providers: transcript, intent, urgency, summary, original recording, and dashboard-ready status.

## Project overview

Many patients in remote Gilgit-Baltistan communities may be more comfortable speaking Balti than typing or describing symptoms in English or Urdu. MarhamPattii helps bridge that gap by accepting a patient audio recording, transcribing it with a Balti ASR pipeline, extracting structured medical communication intent with Groq, storing the original audio in Supabase Storage, and saving the request metadata in Supabase Postgres for a provider dashboard.

The current integrated app supports:

- Frontend UI screens from the `frontend-fizza` branch merged into `AI-iman`.
- Patient-side recording, processing, confirmation, and fallback demo-audio flows.
- Provider dashboard request list, request detail view, audio playback, and status actions.
- Uploading patient audio through a Next.js App Router API route.
- Temporarily saving audio locally for Python ASR processing.
- Running the Python ASR wrapper as a JSON-only child process.
- Extracting intent and urgency using Groq.
- Uploading the original audio to Supabase Storage.
- Inserting the final request into the Supabase `requests` table.
- Fetching dashboard requests and updating request status.
- Running a local end-to-end smoke test using `test-e2e-audio.js`.

## Architecture flow

```text
Patient Voice
  -> Next.js API Route /api/requests
  -> Python ASR: mohdali1/whisper-small-balti
  -> Groq Intent Extraction: openai/gpt-oss-20b
  -> Supabase Storage: audio-recordings bucket
  -> Supabase Database: requests table
  -> Provider Dashboard
```


## Current development status

The frontend teammate's UI branch, `frontend-fizza`, has been successfully merged into the active working branch, `AI-iman`. The workspace now contains both the polished patient/provider UI and the verified backend AI pipeline.

Verified and integrated:

- Backend AI/ASR pipeline: local Python wrapper, Balti Whisper ASR, and Groq structured intent extraction are wired through `POST /api/requests`.
- Supabase wiring: audio uploads to the public `audio-recordings` bucket and request rows are inserted into the `requests` table.
- Patient frontend: recording flow, processing state, confirmation screen, `Speak Again`, final sent state, and `Use Demo Audio` fallback are integrated.
- Provider dashboard: live request fetching, request cards, detail page, Supabase `audio_url` playback, and status updates are integrated.
- QA safeguards: `test-e2e-audio.js`, `/api/demo-audio`, `.env.example`, and Vercel deployment notes are present.

Active phases:

1. UI-to-API wiring: implemented and build-verified; continue polishing patient copy and edge-case handling.
2. Provider dashboard data fetching: implemented through `GET /api/requests/dashboard` and `PATCH /api/requests/[id]`; confidence display is pending a future database column.
3. E2E browser testing: API-level E2E is verified; final manual browser walkthrough should be run before presentation using live microphone and the `Use Demo Audio` fallback.

## Repository structure

```text
MarhamPattii/
+- frontend/                  # Next.js App Router frontend/backend API
¦  +- src/app/api/requests/   # Patient request API routes
¦  +- package.json            # Next.js, React, Supabase, Groq dependencies
+- ai-service/                # Python ASR integration layer
¦  +- src/test_pipeline.py    # ASR + Groq pipeline logic
¦  +- src/run_pipeline_json.py# JSON-only wrapper called by Node.js
¦  +- src/download_balti_model.py
¦  +- audio/test2.wav         # Sample audio used by smoke tests
+- database/
¦  +- supabase_policies.sql   # Supabase table/storage RLS helper policies
+- INTEGRATION.md             # Backend/Python integration notes
+- test-e2e-audio.js          # End-to-end local smoke test
+- README.md
```

## Prerequisites

Install these before running locally:

- Node.js 20+ recommended
- npm
- Python 3.10+ recommended
- Git
- A Supabase project
- A Groq API key

## Supabase setup

Create the database table in the Supabase SQL Editor:

```sql
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  language text,
  audio_url text,
  transcript text,
  intent text,
  urgency text,
  status text default 'pending',
  created_at timestamptz default now()
);
```

Create a public storage bucket named:

```text
audio-recordings
```

If local uploads fail with a row-level security error, run the helper SQL in:

```text
database/supabase_policies.sql
```

That file contains policies for request inserts/reads/updates and storage uploads/reads for the public `audio-recordings` bucket.

## Environment variables

Create `frontend/.env.local` with:

```env
GROQ_API_KEY=your_groq_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Optional variables:

```env
GROQ_MODEL_ID=openai/gpt-oss-20b
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_for_server_side_only
```

Notes:

- Do not commit `.env.local` files.
- The current pipeline uses Groq model `openai/gpt-oss-20b` because it is available for the current Groq key. If the team later gets access to `llama-3.3-70b-versatile`, set `GROQ_MODEL_ID=llama-3.3-70b-versatile`.
- Supabase publishable keys are safe for browser usage, but service-role keys are secret and must only be used server-side.

## Getting started

Clone the repository and install frontend dependencies:

```powershell
git clone https://github.com/nawalhasn2738/MarhamPattii.git
cd MarhamPattii
cd frontend
npm install
```

Set up the Python ASR environment from the project root:

```powershell
cd ..
python -m venv ai-service/venv
ai-service/venv/Scripts/python.exe -m pip install --upgrade pip
```

Install the Python packages required by the ASR pipeline. The exact package set may depend on your local environment, but it commonly includes packages such as:

```powershell
ai-service/venv/Scripts/python.exe -m pip install torch transformers librosa soundfile groq python-dotenv
```

If the Balti Whisper model is not already present locally, download it with:

```powershell
ai-service/venv/Scripts/python.exe ai-service/src/download_balti_model.py
```

The downloaded model files are intentionally ignored by Git because they are large.

## Running locally

Start the Next.js development server:

```powershell
cd frontend
npm run dev
```

By default, the app runs on:

```text
http://localhost:3000
```

If port 3000 is busy, Next.js may choose another port. You can either free port 3000 or run tests with `API_BASE_URL` pointing to the active server.

## API routes

### POST `/api/requests`

Accepts multipart form data:

- `audio`: uploaded audio file
- `language`: optional language field, defaults to `Balti`

The route:

1. Saves the uploaded audio to a temporary local file.
2. Calls `ai-service/src/run_pipeline_json.py` using Python.
3. Parses the returned JSON transcript and intent.
4. Uploads the original audio to Supabase Storage.
5. Inserts a row into the Supabase `requests` table.
6. Returns the inserted record and AI result.

### GET `/api/requests/dashboard`

Fetches all records from the `requests` table ordered by newest first.

### PATCH `/api/requests/[id]`

Updates the `status` value for a specific request.

Example statuses:

- `accepted`
- `clarification_requested`
- `completed`

## End-to-end smoke test

From the root directory, keep the Next.js server running in another terminal, then run:

```powershell
node test-e2e-audio.js
```

The test sends:

```text
ai-service/audio/test2.wav
```

to:

```text
http://localhost:3000/api/requests
```

To test a different server URL:

```powershell
$env:API_BASE_URL="http://localhost:3001"
node test-e2e-audio.js
```

A successful test should confirm:

- the API returned success,
- the ASR pipeline returned a transcript,
- Groq returned structured intent data,
- Supabase Storage received the audio,
- Supabase Database inserted the request row.

## Backend and AI integration notes

The Next.js route calls the Python wrapper instead of importing Python directly. This keeps the web API simple and makes the AI service independently testable.

The wrapper script is:

```text
ai-service/src/run_pipeline_json.py
```

It accepts an audio file path, runs the ASR/Groq pipeline, and prints only valid JSON to stdout so Node.js can parse it safely.

More details are available in:

```text
INTEGRATION.md
```

## Team workflow

### Frontend contributors

- Work mainly inside `frontend/`.
- Use API routes instead of calling Supabase directly from UI components when handling patient request creation.
- Use `GET /api/requests/dashboard` to populate the provider dashboard.
- Use `PATCH /api/requests/[id]` to update request status.
- Keep UI state aligned with the `status` field in Supabase.

### Backend contributors

- Keep API route logic inside `frontend/src/app/api/`.
- Validate request inputs before calling Python or Supabase.
- Keep temp file cleanup in `finally` blocks.
- Do not print secrets or raw environment values in logs.
- Prefer clean JSON error responses with useful `code` fields for frontend handling.

### AI contributors

- Keep ASR pipeline changes inside `ai-service/`.
- Ensure `run_pipeline_json.py` always prints only JSON to stdout.
- Put debug logs in captured fields or stderr, not stdout.
- Keep large model files out of Git.

### Database contributors

- Keep SQL migrations and policies inside `database/`.
- Document any Supabase table or bucket changes.
- Be careful with public storage policies and service-role keys.

## Git hygiene

Ignored files include:

- `.env.local`
- Python virtual environments
- Next.js build output
- `node_modules`
- Hugging Face/model caches
- large downloaded model files
- temporary test/debug logs

Before committing, run:

```powershell
git status
```

Then commit only intentional source, configuration, test, and documentation changes.

## Current handoff status

The project is in final QA and production handover state. Backend AI/ASR, Supabase storage/database wiring, patient UI flow, provider dashboard, demo fallback mode, and production build checks are integrated and verified on branch `AI-iman`.

Before a live presentation, run a final manual browser test:

1. Start `cd frontend; npm run dev`.
2. Open `http://localhost:3000/home`.
3. Test live mic recording, or click `Use Demo Audio`.
4. Review the confirmation screen.
5. Open `/requests` and verify the provider dashboard shows the new request.
6. Play the original audio and test `Accept` / `Ask for Clarification`.

If an E2E test reaches Supabase but fails with an RLS error, apply `database/supabase_policies.sql` in the Supabase SQL Editor or configure a server-side `SUPABASE_SERVICE_ROLE_KEY`.