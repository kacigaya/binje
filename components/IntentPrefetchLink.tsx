"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps } from "react";

// Long enough that cards passing through during a scroll don't qualify.
const DWELL_MS = 800;
// Wait for scrolling gestures to trigger pointercancel before treating a held touch as intent.
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

/** In production, keep App Shell prefetch until hover, focus or a still touch warrants a full render.
 * Use `dwell` only on row/grid cards; it skips data-saving and 2G connections. */
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
    // Watch the viewport's middle band; ratio thresholds exclude cards larger than that band.
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
        if (touchTimer.current !== undefined) {
          window.clearTimeout(touchTimer.current);
          touchTimer.current = undefined;
          setIntent(true);
        }
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        window.clearTimeout(touchTimer.current);
        touchTimer.current = undefined;
        onPointerCancel?.(event);
      }}
    />
  );
}
