"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaCard from "@/components/MediaCard";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";
import type { MediaItem } from "@/types/tmdb";
import { useTranslations } from "@/lib/use-locale";

export default function Carousel({
  title,
  items,
  priority = false,
}: {
  title: string;
  items: MediaItem[];
  priority?: boolean;
}) {
  const { t } = useTranslations();
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

      <div className="group/carousel relative">
        {canScrollLeft && (
          <>
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-linear-to-r from-background to-transparent" />
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute left-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity cursor-pointer"
              aria-label={t("Scroll left")}
            >
              <ChevronLeft className="size-8 text-foreground" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 py-2"
        >
          {items.map((item, i) => (
            <MediaCard
              key={`${item.media_type}-${item.id}`}
              item={item}
              eager={priority && i < 6}
            />
          ))}
        </div>

        {canScrollRight && (
          <>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-linear-to-l from-background to-transparent" />
            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute right-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity cursor-pointer"
              aria-label={t("Scroll right")}
            >
              <ChevronRight className="size-8 text-foreground" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
