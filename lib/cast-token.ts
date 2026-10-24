import { randomBytes } from "node:crypto";

const CAST_TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_CAST_TOKENS = 500;
const MAX_CAST_HOSTS = 1000;

const tokens = new Map<string, { expiresAt: number; senderHost: string; hosts: Set<string> }>();

function pruneExpiredTokens(now: number) {
  for (const [token, entry] of tokens) {
    if (now >= entry.expiresAt) tokens.delete(token);
  }
}

export function createCastToken(senderHost: string, hosts: string[]): string {
  const now = Date.now();
  pruneExpiredTokens(now);

  while (tokens.size >= MAX_CAST_TOKENS) {
    const oldest = tokens.keys().next().value;
    if (!oldest) break;
    tokens.delete(oldest);
  }

  const token = randomBytes(24).toString("base64url");
  tokens.set(token, { expiresAt: now + CAST_TOKEN_TTL_MS, senderHost, hosts: new Set(hosts) });
  return token;
}

export function isValidCastToken(token: string | null, senderHost: string, targetHost: string): boolean {
  if (!token || !/^[A-Za-z0-9_-]{32}$/.test(token)) return false;

  const entry = tokens.get(token);
  if (!entry) return false;
  if (Date.now() >= entry.expiresAt) {
    tokens.delete(token);
    return false;
  }
  return entry.senderHost === senderHost && entry.hosts.has(targetHost);
}

export function allowCastHost(token: string, senderHost: string, parentHost: string, targetHost: string): boolean {
  if (!isValidCastToken(token, senderHost, parentHost)) return false;
  const entry = tokens.get(token)!;
  if (entry.hosts.size >= MAX_CAST_HOSTS && !entry.hosts.has(targetHost)) return false;
  entry.hosts.add(targetHost);
  return true;
}
