
export type ResolveResult = {
  url: string;
  tracks?: { file: string; label?: string }[];
  sources?: { file: string; height: number }[];
};

const cache = new Map<string, Promise<ResolveResult>>();

export function fetchResolve(url: string): Promise<ResolveResult> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url).then((response) => {
      if (!response.ok) throw new Error("resolve failed");
      return response.json() as Promise<ResolveResult>;
    });
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}
