/**
 * Local backend smoke test for MarhamPattii.
 *
 * Usage:
 *   node test-backend.js
 *
 * Optional:
 *   API_BASE_URL=http://localhost:3000 node test-backend.js
 */

const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const baseUrl = (process.env.API_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

const requiredEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

function readLocalEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return {
      envPath,
      values: {},
      error: ".env.local was not found in the current directory.",
    };
  }

  const values = {};
  const content = readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    values[key] = value.replace(/^["']|["']$/g, "");
  }

  return { envPath, values };
}

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `${response.url} returned non-JSON content: ${text.slice(0, 300)}`,
    );
  }
}

function testLocalEnvBinding() {
  console.log("Checking local .env.local bindings...");

  const result = readLocalEnvFile();

  if (result.error) {
    throw new Error(`${result.error} Expected path: ${result.envPath}`);
  }

  const missingKeys = requiredEnvKeys.filter((key) => !result.values[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing required .env.local keys: ${missingKeys.join(", ")}`);
  }

  console.log(
    `PASS: .env.local contains ${requiredEnvKeys.length} required Supabase key(s).`,
  );
}

async function testDashboardEndpoint() {
  const url = `${baseUrl}/api/requests/dashboard`;
  console.log(`GET ${url}`);

  let response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `Could not reach ${url}. Make sure you are running "npm run dev" in frontend/.`,
      { cause: error },
    );
  }

  const body = await readJson(response);

  if (response.status !== 200) {
    throw new Error(
      `Expected HTTP 200, got HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  if (body?.success !== true || !Array.isArray(body.requests)) {
    throw new Error(
      `Expected { success: true, requests: [...] }, got: ${JSON.stringify(body)}`,
    );
  }

  console.log(`PASS: dashboard returned ${body.requests.length} request(s).`);
}

async function main() {
  console.log(`Testing MarhamPattii backend at ${baseUrl}\n`);

  testLocalEnvBinding();
  await testDashboardEndpoint();

  console.log("\nAll backend smoke tests passed.");
}

main().catch((error) => {
  console.error("\nBackend smoke test failed:");
  console.error(error instanceof Error ? error.message : error);

  if (error?.cause) {
    console.error(error.cause.message ?? error.cause);
  }

  process.exitCode = 1;
});
