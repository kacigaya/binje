"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { CheckIcon } from "@/components/ui/check";
import { PlusIcon } from "@/components/ui/plus";
import { GlassButton } from "@/components/liquid-glass";
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
    <GlassButton
      {...feedback}
      size="lg"
      tint={0.15}
      onClick={() => {
        savedByClick.current = !added;
        toggleWatchlistWithFeedback(item, added, t);
      }}
      aria-pressed={added}
      icon={
        added ? (
          <CheckIcon ref={icon} size={20} />
        ) : (
          <PlusIcon ref={icon} size={20} />
        )
      }
      iconPosition="start"
      className="w-full sm:w-auto"
    >
      {t(added ? "In Watchlist" : "Add to Watchlist")}
    </GlassButton>
  );
}
