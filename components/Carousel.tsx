"use client";

import Link from "next/link";
import MediaCard from "@/components/MediaCard";
import ScrollArrows from "@/components/ScrollArrows";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";
import { useTranslations } from "@/lib/use-locale";
import type { MediaItem } from "@/types/tmdb";

export default function Carousel({
  title,
  items,
  priority = false,
  seeAllHref,
}: {
  title: string;
  items: MediaItem[];
  priority?: boolean;
  /** Optional link to the full listing, shown beside the title. */
  seeAllHref?: string;
}) {
  const { t } = useTranslations();
  const { scrollRef, canScrollLeft, canScrollRight, scroll } =
    useHorizontalScroll(items);

  return (
    <section className="relative">
      <div className="mb-4 flex items-baseline justify-between gap-4 px-4 sm:px-6">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="shrink-0 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            {t("See all")}
            <span className="sr-only">: {title}</span>
          </Link>
        )}
      </div>

      <div className="group/scroll relative">
        <ScrollArrows
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          scroll={scroll}
        />

        {/* Focusable so the row can be scrolled with the arrow keys: the
            arrow buttons are the only other non-pointer affordance. */}
        <div
          ref={scrollRef}
          tabIndex={0}
          role="group"
          aria-label={title}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/50"
        >
          {items.map((item, i) => (
            <MediaCard
              key={`${item.media_type}-${item.id}`}
              item={item}
              eager={priority && i < 6}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
