"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Check, Plus } from "lucide-react";
import {
  isInWatchlist,
  subscribeToWatchlist,
  toggleWatchlist,
  type WatchlistInput,
} from "@/lib/watchlist";

export default function WatchlistButton({ item }: { item: WatchlistInput }) {
  const getSnapshot = useCallback(
    () => isInWatchlist(item),
    [item],
  );

  const added = useSyncExternalStore(
    subscribeToWatchlist,
    getSnapshot,
    () => false,
  );

  return (
    <button
      type="button"
      onClick={() => toggleWatchlist(item)}
      aria-pressed={added}
      className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border h-12 px-7 text-base font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-red/60 ${
        added
          ? "border-accent-red/60 bg-accent-red/15 text-accent-red hover:bg-accent-red/25"
          : "border-white/15 bg-white/8 text-foreground hover:bg-white/12"
      }`}
    >
      {added ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      {added ? "In Watchlist" : "Add to Watchlist"}
    </button>
  );
}
