"use client";

import { LazyMotion } from "motion/react";

// Icons only animate on hover or focus, so the animation features load after hydration.
const loadFeatures = () => import("./motion-features").then((module) => module.default);

/** `strict` makes a stray `motion.*` import throw, which keeps the full runtime out of the shared bundle. */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
