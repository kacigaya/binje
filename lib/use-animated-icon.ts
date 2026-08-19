"use client";

import { useMemo, useRef } from "react";

/** The imperative surface every `components/ui/*` animated icon exposes. */
export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

/**
 * Drives an animated icon from its control rather than from the glyph itself.
 * Buttons and links are usually far wider than the icon inside them, so the
 * icon's own hover would miss most of the target; focus is wired alongside so
 * keyboard users get the same feedback.
 *
 *     const [icon, feedback] = useAnimatedIcon();
 *     <button {...feedback}><PlayIcon ref={icon} size={20} /></button>
 */
export function useAnimatedIcon() {
  const ref = useRef<AnimatedIconHandle>(null);

  const feedback = useMemo(
    () => ({
      onMouseEnter: () => ref.current?.startAnimation(),
      onMouseLeave: () => ref.current?.stopAnimation(),
      onFocus: () => ref.current?.startAnimation(),
      onBlur: () => ref.current?.stopAnimation(),
    }),
    [],
  );

  return [ref, feedback] as const;
}
