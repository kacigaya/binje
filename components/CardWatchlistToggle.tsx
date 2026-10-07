"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CheckIcon } from "@/components/ui/check";
import { PlusIcon } from "@/components/ui/plus";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { cn } from "@/lib/utils";
import {
  isInWatchlist,
  subscribeToWatchlist,
  toggleWatchlistWithFeedback,
  type WatchlistInput,
} from "@/lib/watchlist";
import { useTranslations } from "@/lib/use-locale";

/**
 * Compact watchlist toggle laid over a poster. It sits beside the card link
 * rather than inside it, since a button nested in a link is invalid and
 * breaks keyboard order. On hover-capable devices it stays out of the way
 * until the card is hovered or focused, unless the title is already saved.
 */
export default function CardWatchlistToggle({
  item,
  className,
}: {
  item: WatchlistInput;
  className?: string;
}) {
  const { t } = useTranslations();
  const [icon, feedback] = useAnimatedIcon();
  const getSnapshot = useCallback(() => isInWatchlist(item), [item]);
  const added = useSyncExternalStore(
    subscribeToWatchlist,
    getSnapshot,
    () => false,
  );
  const label = `${t(added ? "Remove from watchlist" : "Add to Watchlist")}: ${item.title}`;

  return (
    <button
      type="button"
      {...feedback}
      onClick={() => toggleWatchlistWithFeedback(item, added, t)}
      aria-pressed={added}
      aria-label={label}
      title={label}
      className={cn(
        "z-10 flex size-8 cursor-pointer items-center justify-center rounded-lg border text-white transition-[opacity,background-color] duration-200 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red",
        added
          ? "border-accent-red/60 bg-accent-red"
          : "border-white/20 bg-black/65 hover:bg-black/80 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100",
        className,
      )}
    >
      {added ? (
        <CheckIcon ref={icon} size={16} />
      ) : (
        <PlusIcon ref={icon} size={16} />
      )}
    </button>
  );
}
