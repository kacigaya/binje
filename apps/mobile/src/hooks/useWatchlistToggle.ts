import { useRef, useState, useSyncExternalStore } from 'react';
import { useLocale } from '../providers/LocaleProvider';
import { useToast } from '../providers/ToastProvider';
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  subscribeToWatchlist,
  type WatchlistInput,
  type WatchlistItem,
} from '../storage/watchlist';

type MediaKey = Pick<WatchlistItem, 'type' | 'id'>;

// One cached snapshot for every card on screen, so a list does not read storage once per card.
let savedKeys: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
let stopStore: (() => void) | null = null;
const keyOf = (item: MediaKey) => `${item.type}:${item.id}`;

function reload() {
  void getWatchlist().then((items) => {
    savedKeys = new Set(items.map(keyOf));
    listeners.forEach((listener) => listener());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stopStore) {
    stopStore = subscribeToWatchlist(reload);
    reload();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && stopStore) {
      stopStore();
      stopStore = null;
    }
  };
}

export function useIsInWatchlist(item: MediaKey) {
  const key = keyOf(item);
  return useSyncExternalStore(subscribe, () => savedKeys.has(key));
}

/** Save or remove a title with toast feedback and undo. Errors go to `onError`, or to a toast. */
export function useWatchlistToggle(onError?: (message: string) => void) {
  const { t } = useLocale();
  const toast = useToast();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const report = (message: string) => (onError ? onError(message) : toast.show({ message }));

  async function setSaved(input: WatchlistInput, target: boolean, undo = true): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const changed = await (target ? addToWatchlist(input) : removeFromWatchlist(input));
      if (!changed) {
        report(t('storageRequired'));
        return;
      }
      toast.show({
        message: target ? t('addedToWatchlist') : t('removedFromWatchlist'),
        ...(undo ? { actionLabel: t('undo'), onAction: () => void setSaved(input, !target, false) } : {}),
      });
    } catch {
      report(t('saveFailed'));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { setSaved, pending };
}
