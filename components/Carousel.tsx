"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
      <div className="mb-4 flex items-center justify-between gap-4 px-4 sm:px-6">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="group/see-all flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground hover:duration-140 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
          >
            <span className="underline-draw">{t("See all")}</span>
            <span className="sr-only">: {title}</span>
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 ease-ui group-hover/see-all:translate-x-0.75 group-hover/see-all:duration-140 motion-reduce:transition-none"
            />
          </Link>
        )}
      </div>

      <div className="group/scroll relative">
        <ScrollArrows
          canScrollLeft={canScrollLeft}
          canScrollRight={canScrollRight}
          scroll={scroll}
        />

        {/* Focusable so keyboard users can scroll the row with arrow keys. */}
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
