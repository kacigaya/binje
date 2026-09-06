
export type ResolveResult = {
  url: string;
  tracks?: { file: string; label?: string }[];
  sources?: { file: string; height: number }[];
};

const RESOLVE_CACHE = new Map<string, { pending: Promise<ResolveResult>; expiresAt: number }>();

export function fetchResolve(url: string, refresh = false): Promise<ResolveResult> {
  const cached = RESOLVE_CACHE.get(url);
  let pending = !refresh && cached && Date.now() < cached.expiresAt ? cached.pending : undefined;
  if (!pending) {
    pending = fetch(url, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("resolve failed");
      return response.json() as Promise<ResolveResult>;
    });
    const request = pending;
    pending.catch(() => {
      if (RESOLVE_CACHE.get(url)?.pending === request) RESOLVE_CACHE.delete(url);
    });
    if (RESOLVE_CACHE.size >= 100) RESOLVE_CACHE.delete(RESOLVE_CACHE.keys().next().value!);
    RESOLVE_CACHE.set(url, { pending, expiresAt: Date.now() + 60_000 });
  }
  return pending;
}
