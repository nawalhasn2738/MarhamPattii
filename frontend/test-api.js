/**
 * Local smoke test for the MarhamPattii provider API.
 *
 * Usage:
 *   node test-api.js
 *   node test-api.js <request-uuid>
 *
 * Optional environment variable:
 *   API_BASE_URL=http://localhost:3000
 */

const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const suppliedRequestId = process.argv[2];

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `${response.url} returned non-JSON content: ${text.slice(0, 200)}`,
    );
  }
}

async function testDashboard() {
  const url = `${baseUrl}/api/requests/dashboard`;
  console.log(`GET ${url}`);

  const response = await fetch(url);
  const body = await readJson(response);

  if (response.status !== 200) {
    throw new Error(
      `Dashboard request failed with HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  if (!body?.success || !Array.isArray(body.requests)) {
    throw new Error(
      `Dashboard returned an unexpected payload: ${JSON.stringify(body)}`,
    );
  }

  console.log(`PASS: dashboard returned ${body.requests.length} request(s).`);
  return body.requests;
}

async function testStatusUpdate(requestId) {
  const url = `${baseUrl}/api/requests/${encodeURIComponent(requestId)}`;
  console.log(`PATCH ${url}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "accepted" }),
  });
  const body = await readJson(response);

  if (response.status !== 200) {
    throw new Error(
      `Status update failed with HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  if (
    !body?.success ||
    body.request?.id !== requestId ||
    body.request?.status !== "accepted"
  ) {
    throw new Error(
      `PATCH returned an unexpected payload: ${JSON.stringify(body)}`,
    );
  }

  console.log(`PASS: request ${requestId} now has status "accepted".`);
}

async function main() {
  console.log(`Testing MarhamPattii API at ${baseUrl}\n`);

  const requests = await testDashboard();
  const requestId = suppliedRequestId ?? requests[0]?.id;

  if (!requestId) {
    throw new Error(
      "No request ID was supplied and the dashboard returned no records. " +
        "Create a request first or run: node test-api.js <request-uuid>",
    );
  }

  await testStatusUpdate(requestId);
  console.log("\nAll API smoke tests passed.");
}

main().catch((error) => {
  console.error("\nAPI smoke test failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
