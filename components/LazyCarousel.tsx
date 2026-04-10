"use client";

import { useRef, useState, useEffect } from "react";
import Carousel from "@/components/Carousel";
import type { MediaItem } from "@/types/tmdb";

interface LazyCarouselProps {
  title: string;
  items: MediaItem[];
}

/**
 * Defers rendering of a Carousel until it is close to the viewport.
 * This reduces the number of DOM nodes, React event listeners and image
 * decode operations on initial page load, improving Time-to-Interactive
 * and scroll smoothness for below-the-fold sections.
 */
export default function LazyCarousel({ title, items }: LazyCarouselProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Start loading 300 px before the section enters the viewport so there
      // is no perceived delay as the user scrolls down.
      { rootMargin: "300px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    // Reserve approximate carousel height to prevent layout shift.
    <div ref={sentinelRef} className="min-h-[350px]">
      {visible && <Carousel title={title} items={items} />}
    </div>
  );
}
