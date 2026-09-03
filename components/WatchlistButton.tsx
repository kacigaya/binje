"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { CheckIcon } from "@/components/ui/check";
import { PlusIcon } from "@/components/ui/plus";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { toast } from "sonner";
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

  const [icon, feedback] = useAnimatedIcon();
  // Play the check once on the save itself, not only on hover: the tick is the
  // confirmation that the title landed in the watchlist.
  // Tied to the click, not to `added`: the server snapshot is always false, so
  // an already-saved title flips false -> true on hydration too, and keying off
  // the state alone would tick the check on every page load.
  const savedByClick = useRef(false);
  useEffect(() => {
    if (!added || !savedByClick.current) return;
    savedByClick.current = false;
    icon.current?.startAnimation();
  }, [added, icon]);

  return (
    <button
      type="button"
      {...feedback}
      onClick={() => {
        savedByClick.current = !added;
        toggleWatchlist(item);
        toast.success(t(added ? "Removed from watchlist" : "Added to watchlist"));
      }}
      aria-pressed={added}
      className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border h-12 px-7 text-base font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60 ${
        added
          ? "border-accent-red/60 bg-accent-red/15 text-accent-red hover:bg-accent-red/25"
          : "border-white/15 bg-white/8 text-foreground hover:bg-white/12"
      }`}
    >
      {added ? (
        <CheckIcon ref={icon} size={20} />
      ) : (
        <PlusIcon ref={icon} size={20} />
      )}
      {t(added ? "In Watchlist" : "Add to Watchlist")}
    </button>
  );
}
