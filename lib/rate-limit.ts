
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

export function clientIp(headers: Headers): string {
  return headers.get("x-nf-client-connection-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
