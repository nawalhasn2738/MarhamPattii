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

const http = require("node:http");
const https = require("node:https");
const { existsSync, readFileSync } = require("node:fs");
const { basename, resolve } = require("node:path");

const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const audioPath = resolve(
  process.cwd(),
  process.env.TEST_AUDIO_PATH ?? "ai-service/audio/test2.wav",
);
const requestTimeoutMs = Number(process.env.E2E_TIMEOUT_MS ?? 1000 * 60 * 20);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildMultipartBody(audioBuffer) {
  const boundary = `----marhampattii-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const filename = basename(audioPath);
  const chunks = [
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="audio"; filename="${filename}"\r\n` +
        "Content-Type: audio/wav\r\n\r\n",
    ),
    audioBuffer,
    Buffer.from(
      `\r\n--${boundary}\r\n` +
        'Content-Disposition: form-data; name="language"\r\n\r\n' +
        `Balti\r\n--${boundary}--\r\n`,
    ),
  ];

  return {
    boundary,
    body: Buffer.concat(chunks),
  };
}

function postMultipart(endpoint, body, boundary) {
  const url = new URL(endpoint);
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolveRequest, rejectRequest) => {
    const request = client.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
        timeout: requestTimeoutMs,
      },
      (response) => {
        const chunks = [];

        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");

          try {
            resolveRequest({
              status: response.statusCode ?? 0,
              ok: Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300),
              body: text ? JSON.parse(text) : null,
            });
          } catch {
            rejectRequest(
              new Error(`${endpoint} returned non-JSON content: ${text.slice(0, 500)}`),
            );
          }
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Request timed out after ${requestTimeoutMs}ms.`));
    });
    request.on("error", rejectRequest);
    request.end(body);
  });
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
  const { boundary, body: multipartBody } = buildMultipartBody(audioBuffer);

  console.log(`POST ${endpoint}`);
  console.log(`Audio: ${audioPath}`);
  console.log(`Timeout: ${requestTimeoutMs}ms`);

  let response;

  try {
    response = await postMultipart(endpoint, multipartBody, boundary);
  } catch (error) {
    throw new Error(
      `Could not complete request to ${endpoint}. Start the frontend with "cd frontend; npm run dev:3001" first.`,
      { cause: error },
    );
  }

  console.log("\nFull JSON response:");
  console.log(JSON.stringify(response.body, null, 2));

  if (!response.ok) {
    throw new Error(
      `Expected a 2xx response, got HTTP ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  validateResponse(response.body);

  console.log("\nE2E audio smoke test passed.");
  console.log(`Request ID: ${response.body.request.id}`);
  console.log(`ASR status: ${response.body.ai.status}`);
  console.log(`Transcript: ${response.body.ai.transcript}`);
  console.log(`Intent: ${response.body.ai.intent.intent}`);
  console.log(`Urgency: ${response.body.ai.intent.urgency}`);
  console.log(`Audio URL: ${response.body.request.audio_url}`);
}

main().catch((error) => {
  console.error("\nE2E audio smoke test failed:");
  console.error(error instanceof Error ? error.message : error);

  if (error?.cause) {
    console.error(error.cause.message ?? error.cause);
  }

  process.exitCode = 1;
});