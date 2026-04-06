"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaCard from "@/components/MediaCard";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  }

  useEffect(() => {
    checkScroll();
  }, [items]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    setTimeout(checkScroll, 400);
  }

  return (
    <section className="relative">
      <h2
        className="text-xl sm:text-2xl font-bold tracking-tight mb-4 px-4 sm:px-6"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {title}
      </h2>

      <div className="group relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-linear-to-r from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-8 w-8 text-foreground" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 pb-2"
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
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center bg-linear-to-l from-background to-transparent opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-8 w-8 text-foreground" />
          </button>
        )}
      </div>
    </section>
  );
}
