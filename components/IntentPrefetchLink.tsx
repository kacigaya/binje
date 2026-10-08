"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A `<Link>` that keeps the default App Shell prefetch while it sits in the
 * viewport, then upgrades to a full prefetch (`prefetch={true}`) on hover,
 * focus, or touch. The full prefetch resolves the destination's cached,
 * id-dependent TMDB data before the click. Doing that for every visible card
 * would cost one server render per card, so it waits for intent.
 *
 * Prefetching only runs in production builds.
 */
export default function IntentPrefetchLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
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
