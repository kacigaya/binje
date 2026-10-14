"use client";

import { useMemo, useRef } from "react";

/** The imperative surface every `components/ui/*` animated icon exposes. */
export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

/** Drive hover and focus from the whole control so keyboard users and wide targets get feedback.
 * Usage: const [icon, feedback] = useAnimatedIcon(); <button {...feedback}><PlayIcon ref={icon} /></button> */
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
