"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "@appica/ui-react/button";
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
    <Button
      {...feedback}
      onClick={() => {
        savedByClick.current = !added;
        toggleWatchlist(item);
        toast.success(t(added ? "Removed from watchlist" : "Added to watchlist"));
      }}
      aria-pressed={added}
      // `primary-outline` is the saved state: the brand red reads as "this is
      // on your list" without the weight of a filled primary button, which
      // belongs to Watch Now.
      variant={added ? "primary-outline" : "outline"}
      size="lg"
      className="w-full rounded-full px-7 text-base font-semibold sm:w-auto"
    >
      {added ? (
        <CheckIcon ref={icon} data-icon="start" size={20} />
      ) : (
        <PlusIcon ref={icon} data-icon="start" size={20} />
      )}
      {t(added ? "In Watchlist" : "Add to Watchlist")}
    </Button>
  );
}
