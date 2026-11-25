"use client";

import type { MouseEvent } from "react";
import { GlassButton } from "@/components/liquid-glass";
import { XIcon } from "@/components/ui/x";
import { useAnimatedIcon } from "@/lib/use-animated-icon";

/** Each card needs its own icon handle, animated from the whole button's hover target. */
export default function RemoveButton({
  onClick,
  label,
  className,
  iconSize,
}: {
  onClick: (event: MouseEvent<HTMLElement>) => void;
  label: string;
  className: string;
  iconSize: number;
}) {
  const [icon, feedback] = useAnimatedIcon();

  return (
    <GlassButton
      onClick={onClick}
      {...feedback}
      size="sm"
      tint={0.15}
      aria-label={label}
      className={`px-0! ${className}`}
    >
      <XIcon ref={icon} size={iconSize} />
    </GlassButton>
  );
}
