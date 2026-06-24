"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useHorizontalScroll(refreshKey?: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  }, []);

  const onScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      checkScroll();
      rafRef.current = null;
    });
  }, [checkScroll]);

  useEffect(() => {
    checkScroll();
  }, [checkScroll, refreshKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [onScroll]);

  const scroll = useCallback(
    (direction: "left" | "right") => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollBy({
        left: (direction === "left" ? -1 : 1) * el.clientWidth * 0.75,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 400);
    },
    [checkScroll],
  );

  return { scrollRef, canScrollLeft, canScrollRight, scroll };
}
