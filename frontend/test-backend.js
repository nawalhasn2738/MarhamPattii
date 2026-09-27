/**
 * Local secured-backend smoke test for MarhamPattii.
 *
 * Provider authentication (choose one):
 *   PROVIDER_TEST_ACCESS_TOKEN
 * or:
 *   PROVIDER_TEST_EMAIL
 *   PROVIDER_TEST_PASSWORD
 *
 * Run from frontend/ while npm run dev is active:
 *   node test-backend.js
 */

const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const baseUrlValue = process.env.API_BASE_URL ?? "http://localhost:3000";
const baseUrl = baseUrlValue.endsWith("/") ? baseUrlValue.slice(0, -1) : baseUrlValue;

function readLocalEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return { envPath, values: {}, error: ".env.local was not found." };
  }

  const values = {};
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(String.fromCharCode(10))) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    const itemValue = line.slice(separatorIndex + 1).trim();
    values[key] = itemValue.replace(/^["']|["']$/g, "");
  }
  return { envPath, values };
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(response.url + " returned non-JSON content: " + text.slice(0, 300));
  }
}

function value(name, localEnv) {
  return process.env[name] || localEnv[name] || "";
}

async function providerAccessToken(localEnv) {
  const suppliedToken = value("PROVIDER_TEST_ACCESS_TOKEN", localEnv);
  if (suppliedToken) return suppliedToken;

  const supabaseUrl = value("NEXT_PUBLIC_SUPABASE_URL", localEnv);
  const publicKey =
    value("NEXT_PUBLIC_SUPABASE_ANON_KEY", localEnv)
    || value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", localEnv);
  const email = value("PROVIDER_TEST_EMAIL", localEnv);
  const password = value("PROVIDER_TEST_PASSWORD", localEnv);

  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !publicKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    !email && "PROVIDER_TEST_EMAIL",
    !password && "PROVIDER_TEST_PASSWORD",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error("Missing provider test configuration: " + missing.join(", "));
  }

  const response = await fetch(supabaseUrl + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      apikey: publicKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await readJson(response);
  if (!response.ok || typeof body?.access_token !== "string") {
    throw new Error("Provider sign-in failed with HTTP " + response.status + ".");
  }
  if (body.user?.app_metadata?.role !== "provider") {
    throw new Error("The test account is authenticated but does not have app_metadata.role=provider.");
  }
  return body.access_token;
}

async function requestDashboard(authorization) {
  const headers = authorization ? { Authorization: "Bearer " + authorization } : {};
  const response = await fetch(baseUrl + "/api/requests/dashboard", {
    method: "GET",
    headers,
    cache: "no-store",
  });
  return { response, body: await readJson(response) };
}

async function main() {
  console.log("Testing secured backend at " + baseUrl);

  const env = readLocalEnvFile();
  if (env.error) throw new Error(env.error + " Expected path: " + env.envPath);

  console.log("Checking anonymous dashboard rejection...");
  const anonymous = await requestDashboard();
  if (anonymous.response.status !== 401) {
    throw new Error(
      "Expected anonymous request to return HTTP 401, got "
      + anonymous.response.status + ": " + JSON.stringify(anonymous.body),
    );
  }
  console.log("PASS: unauthenticated dashboard access returned 401.");

  console.log("Authenticating provider test account...");
  const token = await providerAccessToken(env.values);

  console.log("Checking authenticated dashboard access...");
  const authorized = await requestDashboard(token);
  if (authorized.response.status !== 200) {
    throw new Error(
      "Expected provider request to return HTTP 200, got "
      + authorized.response.status + ": " + JSON.stringify(authorized.body),
    );
  }
  if (authorized.body?.success !== true || !Array.isArray(authorized.body.requests)) {
    throw new Error("Unexpected dashboard response: " + JSON.stringify(authorized.body));
  }

  console.log("PASS: provider dashboard returned " + authorized.body.requests.length + " request(s).");
  console.log("All secured backend smoke tests passed.");
}

main().catch((error) => {
  console.error("Backend smoke test failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
