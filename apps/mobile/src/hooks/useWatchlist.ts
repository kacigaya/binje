import { useCallback, useEffect, useState } from "react";
import {
  getWatchlist,
  removeFromWatchlist,
  subscribeToWatchlist,
  toggleWatchlist,
  type WatchlistInput,
  type WatchlistItem,
} from "../storage/watchlist";

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const value = await getWatchlist();
    setItems(value);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      void getWatchlist().then((value) => {
        if (!active) return;
        setItems(value);
        setLoading(false);
      });
    };
    load();
    const unsubscribe = subscribeToWatchlist(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const toggle = useCallback((input: WatchlistInput) => toggleWatchlist(input), []);
  const remove = useCallback(
    (item: Pick<WatchlistItem, "type" | "id">) => removeFromWatchlist(item),
    [],
  );
  const contains = useCallback(
    (item: Pick<WatchlistItem, "type" | "id">) =>
      items.some((value) => value.type === item.type && value.id === item.id),
    [items],
  );

  return { items, watchlist: items, isLoading, refresh, toggle, remove, contains };
}
