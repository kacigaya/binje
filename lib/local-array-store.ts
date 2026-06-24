"use client";

type Options<T> = {
  key: string;
  eventName: string;
  limit: number;
  isValid: (value: unknown) => value is T;
  sort: (a: T, b: T) => number;
  canSave: () => boolean;
};

export function createLocalArrayStore<T>({
  key,
  eventName,
  limit,
  isValid,
  sort,
  canSave,
}: Options<T>) {
  let lastRaw: string | null = null;
  let lastSnapshot: T[] = [];

  function get(): T[] {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem(key);
      if (raw === lastRaw) return lastSnapshot;
      lastRaw = raw;

      const parsed: unknown = raw ? JSON.parse(raw) : [];
      lastSnapshot = Array.isArray(parsed)
        ? parsed.filter(isValid).sort(sort).slice(0, limit)
        : [];
      return lastSnapshot;
    } catch {
      lastSnapshot = [];
      return lastSnapshot;
    }
  }

  function save(items: T[]) {
    if (typeof window === "undefined" || !canSave()) return;
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, limit)));
    window.dispatchEvent(new Event(eventName));
  }

  function subscribe(onStoreChange: () => void) {
    if (typeof window === "undefined") return () => {};

    const onStorage = (event: StorageEvent) => {
      if (event.key === key) onStoreChange();
    };

    window.addEventListener(eventName, onStoreChange);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(eventName, onStoreChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { get, save, subscribe };
}
