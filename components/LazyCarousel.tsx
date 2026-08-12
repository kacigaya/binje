"use client";

import { useRef, useState, useEffect } from "react";
import Carousel from "@/components/Carousel";
import CarouselSkeleton from "@/components/CarouselSkeleton";
import type { MediaItem } from "@/types/tmdb";

interface LazyCarouselProps {
  title: string;
  items?: MediaItem[];
  src?: string;
}

export default function LazyCarousel({ title, items = [], src }: LazyCarouselProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loadedItems, setLoadedItems] = useState(items);
  const [loading, setLoading] = useState(Boolean(src));

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

  useEffect(() => {
    if (!visible || !src) return;
    const controller = new AbortController();
    fetch(src, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Browse request failed");
        return response.json() as Promise<{ items?: MediaItem[] }>;
      })
      .then((data) => setLoadedItems(data.items ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [src, visible]);

  return (
    <div ref={sentinelRef} className="min-h-[350px]">
      {visible && loadedItems.length > 0 && <Carousel title={title} items={loadedItems} />}
      {visible && loading && <CarouselSkeleton />}
    </div>
  );
}
