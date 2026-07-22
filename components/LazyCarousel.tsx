"use client";

import { useRef, useState, useEffect } from "react";
import Carousel from "@/components/Carousel";
import type { MediaItem } from "@/types/tmdb";

interface LazyCarouselProps {
  title: string;
  items: MediaItem[];
}

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
      { rootMargin: "300px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sentinelRef} className="min-h-[350px]">
      {visible && <Carousel title={title} items={items} />}
    </div>
  );
}
