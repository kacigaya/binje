"use client";

import { useCallback, useSyncExternalStore } from "react";
import { GlassButton } from "@/components/liquid-glass";
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

/** Keep the button beside the card link; nesting interactive elements breaks keyboard navigation.
 * On hover devices, reveal it on hover or focus unless the title is saved. */
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
    <GlassButton
      {...feedback}
      size="sm"
      material={added ? "tinted" : "clear"}
      tint={0.15}
      onClick={() => toggleWatchlistWithFeedback(item, added, t)}
      aria-pressed={added}
      aria-label={label}
      title={label}
      className={cn(
        "z-10 size-8 rounded-lg px-0! transition-opacity duration-200 focus-visible:opacity-100",
        added
          ? "bg-accent-red text-white"
          : "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100",
        className,
      )}
    >
      {added ? (
        <CheckIcon ref={icon} size={16} />
      ) : (
        <PlusIcon ref={icon} size={16} />
      )}
    </GlassButton>
  );
}
