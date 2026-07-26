
export type ResolveResult = {
  url: string;
  tracks?: { file: string; label?: string }[];
  sources?: { file: string; height: number }[];
};

/** Why a resolve attempt failed, so callers can show an actionable message. */
export type ResolveFailure = "invalid" | "unavailable" | "network";

export class ResolveError extends Error {
  readonly reason: ResolveFailure;
  readonly status: number;

  constructor(reason: ResolveFailure, status = 0) {
    super(`resolve failed: ${reason}`);
    this.name = "ResolveError";
    this.reason = reason;
    this.status = status;
  }
}

const cache = new Map<string, Promise<ResolveResult>>();

export function clearResolveCache(url?: string) {
  if (url === undefined) cache.clear();
  else cache.delete(url);
}

export function fetchResolve(url: string): Promise<ResolveResult> {
  const cached = cache.get(url);
  if (cached) return cached;

  const pending = (async (): Promise<ResolveResult> => {
    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new ResolveError("network");
    }
    if (!response.ok) {
      // 400 rejected params and 404 not-in-library are both permanent: no
      // amount of retrying will produce a stream for this request.
      const permanent = response.status === 400 || response.status === 404;
      throw new ResolveError(permanent ? "invalid" : "unavailable", response.status);
    }
    try {
      return (await response.json()) as ResolveResult;
    } catch {
      throw new ResolveError("unavailable", response.status);
    }
  })();

  // Drop failures so a retry refetches, but never evict a newer entry that a
  // retry already stored while this rejection was still pending.
  pending.catch(() => {
    if (cache.get(url) === pending) cache.delete(url);
  });
  cache.set(url, pending);
  return pending;
}
