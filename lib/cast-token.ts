import { randomBytes } from "node:crypto";

const CAST_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CAST_TOKENS = 500;

const tokens = new Map<string, number>();

function pruneExpiredTokens(now: number) {
  for (const [token, expiresAt] of tokens) {
    if (now >= expiresAt) tokens.delete(token);
  }
}

export function createCastToken(): string {
  const now = Date.now();
  pruneExpiredTokens(now);

  while (tokens.size >= MAX_CAST_TOKENS) {
    const oldest = tokens.keys().next().value;
    if (!oldest) break;
    tokens.delete(oldest);
  }

  const token = randomBytes(24).toString("base64url");
  tokens.set(token, now + CAST_TOKEN_TTL_MS);
  return token;
}

export function isValidCastToken(token: string | null): boolean {
  if (!token || !/^[A-Za-z0-9_-]{32}$/.test(token)) return false;

  const expiresAt = tokens.get(token);
  if (expiresAt === undefined) return false;
  if (Date.now() >= expiresAt) {
    tokens.delete(token);
    return false;
  }
  return true;
}
