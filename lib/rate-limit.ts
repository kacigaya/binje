
const WINDOW_MS = 60_000;

const LIMITS: [prefix: string, max: number][] = [
  ["/api/hls", 600],
  ["/api/resolve", 20],
];
const DEFAULT_LIMIT = 60;

const hits = new Map<string, { count: number; resetAt: number }>();

export function bucketFor(pathname: string): [string, number] {
  return LIMITS.find(([prefix]) => pathname.startsWith(prefix)) ?? ["/api", DEFAULT_LIMIT];
}

// Only the right-most x-forwarded-for entry is trustworthy: it is the one the
// reverse proxy in front of this app appended. Everything to its left, and any
// other client-supplied IP header, is spoofable.
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",") ?? [];
  return forwarded[forwarded.length - 1]?.trim() || "unknown";
}

export function isRateLimited(ip: string, pathname: string): boolean {
  const now = Date.now();
  const [bucket, max] = bucketFor(pathname);
  const key = `${ip}:${bucket}`;
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > max;
}
