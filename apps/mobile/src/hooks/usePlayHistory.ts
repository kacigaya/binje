import { useCallback, useEffect, useState } from "react";
import {
  clearPlayHistory,
  getPlayHistory,
  removePlayHistoryItem,
  subscribeToPlayHistory,
  updatePlayHistoryProgress,
  upsertPlayHistory,
  type PlayHistoryInput,
  type PlayHistoryItem,
  type PlayHistoryProgressInput,
} from "../storage/playHistory";

export function usePlayHistory() {
  const [items, setItems] = useState<PlayHistoryItem[]>([]);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const value = await getPlayHistory();
    setItems(value);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => {
      void getPlayHistory().then((value) => {
        if (!active) return;
        setItems(value);
        setLoading(false);
      });
    };
    load();
    const unsubscribe = subscribeToPlayHistory(load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const upsert = useCallback((input: PlayHistoryInput) => upsertPlayHistory(input), []);
  const updateProgress = useCallback(
    (input: PlayHistoryProgressInput) => updatePlayHistoryProgress(input),
    [],
  );
  const remove = useCallback(
    (item: Pick<PlayHistoryItem, "type" | "id">) => removePlayHistoryItem(item),
    [],
  );
  const clear = useCallback(() => clearPlayHistory(), []);

  return { items, history: items, isLoading, refresh, upsert, updateProgress, remove, clear };
}
