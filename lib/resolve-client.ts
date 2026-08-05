
export type ResolveResult = {
  url: string;
  tracks?: { file: string; label?: string }[];
  sources?: { file: string; height: number }[];
};

const RESOLVE_CACHE = new Map<string, Promise<ResolveResult>>();

export function fetchResolve(url: string): Promise<ResolveResult> {
  let pending = RESOLVE_CACHE.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error("resolve failed");
      return response.json() as Promise<ResolveResult>;
    });
    pending.catch(() => RESOLVE_CACHE.delete(url));
    RESOLVE_CACHE.set(url, pending);
  }
  return pending;
}
