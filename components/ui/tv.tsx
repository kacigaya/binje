"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation, useReducedMotion } from "motion/react";
import type { HTMLAttributes } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Written by hand on the lucide-animated component shape because the registry
 * has no `tv` entry, and the nav row needs the real Lucide glyph rather than a
 * near-miss like `airplay` or `monitor-check`.
 */
export interface TvIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface TvIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const ANTENNA_VARIANTS: Variants = {
  normal: {
    rotate: 0,
    originX: "12px",
    originY: "7px",
  },
  animate: {
    rotate: [0, -12, 10, 0],
    transition: {
      duration: 0.5,
      times: [0, 0.3, 0.6, 1],
      ease: "easeInOut",
    },
  },
};

const TvIcon = forwardRef<TvIconHandle, TvIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const controls = useAnimation();
    // The rest of the app honours prefers-reduced-motion; these icons must too.
    const reduced = useReducedMotion();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;

      return {
        startAnimation: () => {
          if (!reduced) controls.start("animate");
        },
        stopAnimation: () => controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseEnter?.(e);
        } else if (!reduced) {
          controls.start("animate");
        }
      },
      [controls, onMouseEnter, reduced]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) {
          onMouseLeave?.(e);
        } else {
          controls.start("normal");
        }
      },
      [controls, onMouseLeave]
    );

    return (
      <div
        className={cn(className)}
        aria-hidden="true"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <svg
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          style={{ overflow: "visible" }}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path
            animate={controls}
            d="m17 2-5 5-5-5"
            variants={ANTENNA_VARIANTS}
          />
          <rect width="20" height="15" x="2" y="7" rx="2" />
        </svg>
      </div>
    );
  }
);

TvIcon.displayName = "TvIcon";

export { TvIcon };
