"use client";

import { GlassButton } from "@/components/liquid-glass";
import { ChevronLeftIcon } from "@/components/ui/chevron-left";
import { ChevronRightIcon } from "@/components/ui/chevron-right";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { useTranslations } from "@/lib/use-locale";

/** The parent needs `group/scroll` for the hover reveal. */
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
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-20 flex w-12 items-center justify-center opacity-0 transition-opacity group-hover/scroll:opacity-100 has-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
            <GlassButton
              onClick={() => scroll("left")}
              {...leftFeedback}
              tint={0.15}
              aria-label={t("Scroll left")}
              className="pointer-events-auto size-10 px-0!"
            >
              <ChevronLeftIcon ref={leftIcon} size={24} />
            </GlassButton>
          </div>
        </>
      )}

      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-linear-to-l from-background to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 flex w-12 items-center justify-center opacity-0 transition-opacity group-hover/scroll:opacity-100 has-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
            <GlassButton
              onClick={() => scroll("right")}
              {...rightFeedback}
              tint={0.15}
              aria-label={t("Scroll right")}
              className="pointer-events-auto size-10 px-0!"
            >
              <ChevronRightIcon ref={rightIcon} size={24} />
            </GlassButton>
          </div>
        </>
      )}
    </>
  );
}
