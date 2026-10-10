"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps } from "react";

// Long enough that cards passing through during a scroll don't qualify.
const DWELL_MS = 800;
// A finger that starts a scroll moves past the browser's pan threshold, and
// fires pointercancel, well within this window. A still finger is a tap.
const TOUCH_STILL_MS = 50;

// Network Information API is Chromium-only and missing from TypeScript's DOM lib.
type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
};

function savesData() {
  const { connection } = navigator as NavigatorWithConnection;
  return (
    connection?.saveData === true ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  );
}

/**
 * A `<Link>` that keeps the default App Shell prefetch while it sits in the
 * viewport, then upgrades to a full prefetch (`prefetch={true}`) on hover,
 * focus, or a touch that is not the start of a scroll. The full prefetch
 * resolves the destination's cached, id-dependent TMDB data before the click.
 * Doing that for every visible card would cost one server render per card, so
 * it waits for intent.
 *
 * Touch screens have no hover, so with `dwell` the link also counts a stop
 * near the middle of the viewport as intent. Only for cards in rows and
 * grids: links that are always on screen would all prefetch. Skipped when
 * the user asked to save data or the connection is 2G.
 *
 * Prefetching only runs in production builds.
 */
export default function IntentPrefetchLink({
  dwell = false,
  onMouseEnter,
  onFocus,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch" | "ref"> & {
  dwell?: boolean;
}) {
  const [intent, setIntent] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);
  const touchTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(touchTimer.current), []);

  useEffect(() => {
    const element = ref.current;
    if (
      !dwell ||
      intent ||
      !element ||
      !window.matchMedia("(hover: none)").matches ||
      savesData()
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
      onPointerDown={(event) => {
        if (event.pointerType === "touch") {
          window.clearTimeout(touchTimer.current);
          touchTimer.current = window.setTimeout(() => {
            touchTimer.current = undefined;
            setIntent(true);
          }, TOUCH_STILL_MS);
        }
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        // A tap shorter than the still window.
        if (touchTimer.current !== undefined) {
          window.clearTimeout(touchTimer.current);
          touchTimer.current = undefined;
          setIntent(true);
        }
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        // The browser took the gesture over as a scroll.
        window.clearTimeout(touchTimer.current);
        touchTimer.current = undefined;
        onPointerCancel?.(event);
      }}
    />
  );
}
