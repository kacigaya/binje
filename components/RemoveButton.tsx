"use client";

import type { MouseEvent } from "react";
import { XIcon } from "@/components/ui/x";
import { useAnimatedIcon } from "@/lib/use-animated-icon";

/** Each card needs its own icon handle, animated from the whole button's hover target. */
export default function RemoveButton({
  onClick,
  label,
  className,
  iconSize,
}: {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  label: string;
  className: string;
  iconSize: number;
}) {
  const [icon, feedback] = useAnimatedIcon();

  return (
    <button
      type="button"
      onClick={onClick}
      {...feedback}
      aria-label={label}
      className={className}
    >
      <XIcon ref={icon} size={iconSize} />
    </button>
  );
}
