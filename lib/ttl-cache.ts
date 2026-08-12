type Entry<T> = { value: Promise<T>; expiresAt: number };

export function createTtlCache<T>(ttlMs: number, maxEntries = 500) {
  const entries = new Map<string, Entry<T>>();
  return {
    get(key: string, load: () => Promise<T>) {
      const now = Date.now();
      const hit = entries.get(key);
      if (hit && now < hit.expiresAt) return hit.value;
      for (const [entryKey, entry] of entries) {
        if (now > entry.expiresAt || entries.size >= maxEntries) entries.delete(entryKey);
      }
      const value = load();
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      entries.set(key, { value, expiresAt: now + ttlMs });
      return value;
    },
  };
}
