import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { requiredServerSecret } from "@/lib/server/config";

const DRAFT_TOKEN_TTL_SECONDS = 2 * 60 * 60;

export class DraftAuthorizationError extends Error {
  constructor(message: string, readonly status: 401 | 403 = 401) {
    super(message);
    this.name = "DraftAuthorizationError";
  }
}

function signingSecret(): string {
  return requiredServerSecret("DRAFT_CONFIRMATION_SECRET");
}

function signature(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createDraftToken(requestId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + DRAFT_TOKEN_TTL_SECONDS;
  const payload = `${requestId}.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}

export function requireDraftToken(request: Request, requestId: string): void {
  const token = request.headers.get("x-draft-token")?.trim();
  if (!token) {
    throw new DraftAuthorizationError("Draft authorization is required.");
  }

  const [tokenRequestId, expiresValue, receivedSignature, ...extra] = token.split(".");
  if (extra.length || !tokenRequestId || !expiresValue || !receivedSignature || tokenRequestId !== requestId) {
    throw new DraftAuthorizationError("Draft authorization is invalid.", 403);
  }

  const expiresAt = Number(expiresValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new DraftAuthorizationError("Draft authorization has expired.", 403);
  }

  const payload = `${tokenRequestId}.${expiresValue}`;
  const expected = Buffer.from(signature(payload));
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new DraftAuthorizationError("Draft authorization is invalid.", 403);
  }
}
