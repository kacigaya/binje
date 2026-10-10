"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps } from "react";

// Long enough that cards passing through during a scroll don't qualify.
const DWELL_MS = 800;

/**
 * A `<Link>` that keeps the default App Shell prefetch while it sits in the
 * viewport, then upgrades to a full prefetch (`prefetch={true}`) on hover,
 * focus, or touch. The full prefetch resolves the destination's cached,
 * id-dependent TMDB data before the click. Doing that for every visible card
 * would cost one server render per card, so it waits for intent.
 *
 * Touch screens have no hover, so with `dwell` the link also counts a stop
 * near the middle of the viewport as intent. Only for cards in rows and
 * grids: links that are always on screen would all prefetch.
 *
 * Prefetching only runs in production builds.
 */
export default function IntentPrefetchLink({
  dwell = false,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch" | "ref"> & {
  dwell?: boolean;
}) {
  const [intent, setIntent] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !dwell ||
      intent ||
      !element ||
      !window.matchMedia("(hover: none)").matches
    ) {
      return;
    }

    let timer: number | undefined;
    // A thin band across the vertical middle of the viewport: the cards in
    // the row being looked at, minus ones peeking in at the screen edges.
    // No ratio threshold: cards larger than the band could never reach it.
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (entry?.isIntersecting) {
          timer = window.setTimeout(() => setIntent(true), DWELL_MS);
        }
      },
      { rootMargin: "-45% -10%" },
    );
    observer.observe(element);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [dwell, intent]);

  return (
    <Link
      {...props}
      ref={ref}
      prefetch={intent ? true : "auto"}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
