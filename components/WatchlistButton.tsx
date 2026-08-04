"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { ACTION_BUTTON_CLASS, buttonClassName } from "@/components/ui/button";
import {
  isInWatchlist,
  subscribeToWatchlist,
  toggleWatchlist,
  type WatchlistInput,
} from "@/lib/watchlist";
import { useTranslations } from "@/lib/use-locale";

export default function WatchlistButton({ item }: { item: WatchlistInput }) {
  const { t } = useTranslations();
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
      onClick={() => {
        toggleWatchlist(item);
        toast.success(t(added ? "Removed from watchlist" : "Added to watchlist"));
      }}
      aria-pressed={added}
      className={buttonClassName({
        variant: "outline",
        size: "lg",
        className: `${ACTION_BUTTON_CLASS} border ${
          added
            ? "border-accent-red/60 bg-accent-red/15 text-accent-red hover:bg-accent-red/25"
            : "border-white/15 bg-white/8 text-foreground hover:bg-white/12"
        }`,
      })}
    >
      {added ? <Check className="size-5" /> : <Plus className="size-5" />}
      {t(added ? "In Watchlist" : "Add to Watchlist")}
    </button>
  );
}
