// Small in-process cache with single-flight: concurrent callers for one key
// share a single upstream request instead of stampeding the provider.
// ponytail: per-instance and lost on restart, same trade-off as lib/hls-hosts.ts.
type Entry<T> = { value: Promise<T>; expiresAt: number };

export type TtlCache<T> = {
  get(key: string, load: () => Promise<T>): Promise<T>;
  clear(): void;
};

export function createTtlCache<T>(ttlMs: number, maxEntries = 500): TtlCache<T> {
  const entries = new Map<string, Entry<T>>();

  function prune(now: number) {
    for (const [key, entry] of entries) if (now > entry.expiresAt) entries.delete(key);
    // Map iterates in insertion order, so the leftovers drop oldest first.
    for (const key of entries.keys()) {
      if (entries.size < maxEntries) break;
      entries.delete(key);
    }
  }

  return {
    get(key, load) {
      const now = Date.now();
      const hit = entries.get(key);
      if (hit && now < hit.expiresAt) return hit.value;

      const value = load();
      // A rejected lookup must not be served for the rest of the window.
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      if (entries.size >= maxEntries) prune(now);
      entries.set(key, { value, expiresAt: now + ttlMs });
      return value;
    },
    clear() {
      entries.clear();
    },
  };
}
