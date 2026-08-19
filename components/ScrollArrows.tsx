"use client";

import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { useTranslations } from "@/lib/use-locale";

/**
 * Edge fade + chevron button pair for a `useHorizontalScroll` row.
 * The parent must carry the `group/scroll` class for the hover reveal to work.
 */
export default function ScrollArrows({
  canScrollLeft,
  canScrollRight,
  scroll,
}: {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scroll: (direction: "left" | "right") => void;
}) {
  const { t } = useTranslations();
  const [leftIcon, leftFeedback] = useAnimatedIcon();
  const [rightIcon, rightFeedback] = useAnimatedIcon();

  return (
    <>
      {canScrollLeft && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-linear-to-r from-background to-transparent" />
          <button
            type="button"
            onClick={() => scroll("left")}
            {...leftFeedback}
            className="absolute left-0 top-0 bottom-0 z-20 w-12 flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity cursor-pointer"
            aria-label={t("Scroll left")}
          >
            <ChevronLeftIcon ref={leftIcon} size={32} className="text-foreground" />
          </button>
        </>
      )}

      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-linear-to-l from-background to-transparent" />
          <button
            type="button"
            onClick={() => scroll("right")}
            {...rightFeedback}
            className="absolute right-0 top-0 bottom-0 z-20 w-12 flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity cursor-pointer"
            aria-label={t("Scroll right")}
          >
            <ChevronRightIcon ref={rightIcon} size={32} className="text-foreground" />
          </button>
        </>
      )}
    </>
  );
}
