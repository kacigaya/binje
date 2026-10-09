"use client";

import Image from "next/image";
import ScrollArrows from "@/components/ScrollArrows";
import { useHorizontalScroll } from "@/lib/use-horizontal-scroll";

export interface CastMember {
  key: string;
  name: string;
  character: string;
  photo: string | null;
}

/** Cast strip for detail pages, with the same edge fade and arrows as Carousel. */
export default function CastRow({ label, cast }: { label: string; cast: CastMember[] }) {
  const { scrollRef, canScrollLeft, canScrollRight, scroll } = useHorizontalScroll(cast);

  return (
    <div className="group/scroll relative">
      <ScrollArrows
        canScrollLeft={canScrollLeft}
        canScrollRight={canScrollRight}
        scroll={scroll}
      />

      <div
        ref={scrollRef}
        tabIndex={0}
        role="group"
        aria-label={label}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/50"
      >
        {cast.map((person) => (
          <div key={person.key} className="w-27.5 shrink-0 text-center">
            <div className="relative mx-auto mb-2 size-27.5 overflow-hidden rounded-full bg-muted">
              {person.photo ? (
                <Image src={person.photo} alt={person.name} fill loading="lazy" className="object-cover" sizes="110px" />
              ) : (
                <div className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
                  {person.name.charAt(0)}
                </div>
              )}
            </div>
            <p className="line-clamp-1 text-sm font-medium leading-tight">{person.name}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{person.character}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
