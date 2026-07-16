import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoreListener = () => void;

export interface JsonStore<T> {
  get(): Promise<T>;
  set(value: T): Promise<void>;
  remove(): Promise<void>;
  subscribe(listener: StoreListener): () => void;
}

export function createJsonStore<T>(
  key: string,
  validate: (value: unknown) => value is T,
  fallback: T,
): JsonStore<T> {
  const listeners = new Set<StoreListener>();
  const notify = () => listeners.forEach(listener => listener());

  return {
    async get() {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed: unknown = JSON.parse(raw);
        return validate(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    },
    async set(value) {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      notify();
    },
    async remove() {
      await AsyncStorage.removeItem(key);
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
