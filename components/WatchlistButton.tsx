"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { CheckIcon } from "@/components/ui/check";
import { PlusIcon } from "@/components/ui/plus";
import { buttonClassName } from "@/components/ui/button";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import {
  isInWatchlist,
  subscribeToWatchlist,
  toggleWatchlistWithFeedback,
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
  // Animate on clicks; saved-state hydration would otherwise trigger the animation on page load.
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
        toggleWatchlistWithFeedback(item, added, t);
      }}
      aria-pressed={added}
      className={buttonClassName({
        variant: "glass",
        size: "xl",
        className: `w-full sm:w-auto cursor-pointer ${
          added
            ? "border-accent-red/60 bg-accent-red/15 text-accent-red-text hover:bg-accent-red/25"
            : ""
        }`,
      })}
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
