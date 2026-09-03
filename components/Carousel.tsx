"use client";

import MediaCard from "@/components/MediaCard";
import ScrollArrows from "@/components/ScrollArrows";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";
import type { MediaItem } from "@/types/tmdb";

export default function Carousel({
  title,
  items,
  priority = false,
}: {
  title: string;
  items: MediaItem[];
  priority?: boolean;
}) {
  const { scrollRef, canScrollLeft, canScrollRight, scroll } =
    useHorizontalScroll(items);

  return (
    <section className="relative">
      <h2
        className="text-xl sm:text-2xl font-bold tracking-tight mb-4 px-4 sm:px-6"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h2>

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
