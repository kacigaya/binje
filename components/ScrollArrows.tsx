"use client";

import { useRef } from "react";
import {
  ChevronLeftIcon,
  type ChevronLeftIconHandle,
} from "@/components/ui/chevron-left";
import {
  ChevronRightIcon,
  type ChevronRightIconHandle,
} from "@/components/ui/chevron-right";
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
  // The buttons are far wider than their icon, so the animation is driven from
  // the button instead of the icon's own hover.
  const leftIcon = useRef<ChevronLeftIconHandle>(null);
  const rightIcon = useRef<ChevronRightIconHandle>(null);

  return (
    <>
      {canScrollLeft && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-linear-to-r from-background to-transparent" />
          <button
            type="button"
            onClick={() => scroll("left")}
            onMouseEnter={() => leftIcon.current?.startAnimation()}
            onMouseLeave={() => leftIcon.current?.stopAnimation()}
            onFocus={() => leftIcon.current?.startAnimation()}
            onBlur={() => leftIcon.current?.stopAnimation()}
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
            onMouseEnter={() => rightIcon.current?.startAnimation()}
            onMouseLeave={() => rightIcon.current?.stopAnimation()}
            onFocus={() => rightIcon.current?.startAnimation()}
            onBlur={() => rightIcon.current?.stopAnimation()}
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
