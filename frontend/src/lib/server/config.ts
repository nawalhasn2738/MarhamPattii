import "server-only";

export const VERCEL_MAX_DURATION_SECONDS = 60;
export const REQUEST_DEADLINE_MS = 55_000;
export const HF_TIMEOUT_MS = 32_000;
export const GROQ_TIMEOUT_MS = 15_000;

export class ServerConfigurationError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required server environment variable: ${variable}`);
    this.name = "ServerConfigurationError";
  }
}

export function requiredServerEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ServerConfigurationError(name);
  return value;
}

export function requireServerEnvList(names: readonly string[]): void {
  for (const name of names) requiredServerEnv(name);
}

export function requiredServerSecret(name: string, minimumLength = 32): string {
  const value = requiredServerEnv(name);
  if (value.length < minimumLength) {
    throw new ServerConfigurationError(`${name} (must contain at least ${minimumLength} characters)`);
  }
  return value;
}
