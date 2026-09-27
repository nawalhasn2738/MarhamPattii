# MarhamPattii Audio Pipeline Integration

This project connects a Next.js API route to Iman's Python ASR pipeline for
patient voice requests.

## Request Flow

1. The frontend sends a `multipart/form-data` POST request to:

   ```text
   POST http://localhost:3000/api/requests
   ```

   Required field:

   ```text
   audio = uploaded audio file
   ```

   Optional field:

   ```text
   language = Balti
   ```

2. The Next.js route saves the uploaded audio temporarily under:

   ```text
   frontend/tmp/uploads/
   ```

3. The route calls the Python JSON wrapper with Node's `child_process.execFile`:

   ```text
   python ai-service/src/run_pipeline_json.py <temp-audio-path>
   ```

   If your machine uses a different Python executable, set:

   ```text
   PYTHON_BIN=python
   ```

4. The Python wrapper loads `ai-service/.env.local`, runs:

   ```python
   run_pipeline(audio_path)
   ```

   and prints exactly one JSON object to stdout. This is important because the
   Node.js API route parses stdout directly.

5. The ASR pipeline returns:

   ```json
   {
     "status": "ok",
     "transcript": "...",
     "intent": {
       "intent": "doctor_request",
       "duration": null,
       "urgency": "routine",
       "requires_human": true,
       "summary_for_provider": "..."
     },
     "llm_model": "openai/gpt-oss-20b"
   }
   ```

6. The Next.js route uploads the audio file to the Supabase Storage bucket:

   ```text
   audio-recordings
   ```

7. The route inserts a row into the Supabase `requests` table with:

   ```text
   language
   audio_url
   transcript
   intent
   urgency
   status = pending
   ```

8. The temporary local audio file is deleted in a `finally` block.

## Local Setup

Install frontend dependencies:

```powershell
cd frontend
npm install
```

Install Python dependencies:

```powershell
cd ai-service
pip install -r requirements.txt
```

Required environment files:

```text
frontend/.env.local
ai-service/.env.local
```

`frontend/.env.local` must include Supabase values. `ai-service/.env.local` must
include:

```text
GROQ_API_KEY=...
GROQ_MODEL_ID=openai/gpt-oss-20b
```

## Local Testing

Start Next.js:

```powershell
cd frontend
npm run dev
```

Run the end-to-end audio test from a second terminal:

```powershell
node test-e2e-audio.js
```

The test posts `ai-service/audio/test2.wav` to the API route and verifies:

- a non-empty ASR transcript
- structured Groq intent
- Supabase Storage upload
- Supabase `requests` row insertion

## Error Handling

The Next.js route returns structured errors for common bridge failures:

- `python_not_found`: Python executable is missing or `PYTHON_BIN` is wrong.
- `python_dependency_missing`: Python packages such as `transformers`, `groq`,
  or `python-dotenv` are missing.
- `pipeline_timeout`: the ASR process took too long.
- `pipeline_invalid_json`: Python stdout was not valid JSON.
- `pipeline_empty_output`: Python printed no JSON.
- `asr_failed`: audio could not be transcribed, for example silent or corrupted
  audio.

