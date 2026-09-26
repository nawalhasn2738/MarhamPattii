/**
 * End-to-end smoke test for MarhamPattii audio request flow.
 *
 * It sends ai-service/audio/test2.wav to the local Next.js API route and
 * verifies ASR transcript, structured AI intent, and Supabase insertion.
 *
 * Usage:
 *   node test-e2e-audio.js
 *
 * Optional:
 *   API_BASE_URL=http://localhost:3000 node test-e2e-audio.js
 *   TEST_AUDIO_PATH=ai-service/audio/test2.wav node test-e2e-audio.js
 */

const { existsSync, readFileSync } = require("node:fs");
const { basename, resolve } = require("node:path");

const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const audioPath = resolve(
  process.cwd(),
  process.env.TEST_AUDIO_PATH ?? "ai-service/audio/test2.wav",
);

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `${response.url} returned non-JSON content: ${text.slice(0, 500)}`,
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateResponse(body) {
  assert(body && typeof body === "object", "Response body must be a JSON object.");
  assert(body.success === true, `Expected success: true, got ${JSON.stringify(body)}`);

  assert(body.ai && typeof body.ai === "object", "Missing ai result object.");
  assert(
    typeof body.ai.transcript === "string" && body.ai.transcript.trim().length > 0,
    "Expected a non-empty ASR transcript.",
  );
  assert(body.ai.intent && typeof body.ai.intent === "object", "Missing structured AI intent.");
  assert(
    typeof body.ai.intent.intent === "string" && body.ai.intent.intent.length > 0,
    "Expected ai.intent.intent to be a non-empty string.",
  );
  assert(
    typeof body.ai.intent.urgency === "string" && body.ai.intent.urgency.length > 0,
    "Expected ai.intent.urgency to be a non-empty string.",
  );

  assert(body.request && typeof body.request === "object", "Missing inserted Supabase request.");
  assert(
    typeof body.request.id === "string" && body.request.id.length > 0,
    "Expected inserted request to include an id.",
  );
  assert(
    typeof body.request.audio_url === "string" && body.request.audio_url.length > 0,
    "Expected inserted request to include audio_url.",
  );
  assert(
    body.request.transcript === body.ai.transcript,
    "Expected database transcript to match AI transcript.",
  );
  assert(
    body.request.intent === body.ai.intent.intent,
    "Expected database intent to match AI intent.",
  );
}

async function main() {
  if (!existsSync(audioPath)) {
    throw new Error(`Sample audio file not found: ${audioPath}`);
  }

  const endpoint = `${baseUrl}/api/requests`;
  const audioBuffer = readFileSync(audioPath);
  const formData = new FormData();

  formData.append(
    "audio",
    new Blob([audioBuffer], { type: "audio/wav" }),
    basename(audioPath),
  );
  formData.append("language", "Balti");

  console.log(`POST ${endpoint}`);
  console.log(`Audio: ${audioPath}`);

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw new Error(
      `Could not reach ${endpoint}. Start the frontend with "cd frontend; npm run dev" first.`,
      { cause: error },
    );
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(
      `Expected a 2xx response, got HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  validateResponse(body);

  console.log("\nE2E audio smoke test passed.");
  console.log(`Request ID: ${body.request.id}`);
  console.log(`ASR status: ${body.ai.status}`);
  console.log(`Transcript: ${body.ai.transcript}`);
  console.log(`Intent: ${body.ai.intent.intent}`);
  console.log(`Urgency: ${body.ai.intent.urgency}`);
  console.log(`Audio URL: ${body.request.audio_url}`);
}

main().catch((error) => {
  console.error("\nE2E audio smoke test failed:");
  console.error(error instanceof Error ? error.message : error);

  if (error?.cause) {
    console.error(error.cause.message ?? error.cause);
  }

  process.exitCode = 1;
});
