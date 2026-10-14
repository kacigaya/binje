"use client";

import type { MouseEvent } from "react";
import { XIcon } from "@/components/ui/x";
import { useAnimatedIcon } from "@/lib/use-animated-icon";

/**
 * The remove control repeated over card grids. It exists so each card owns its
 * own icon handle: the animation is driven from the button, which is several
 * times the size of the cross inside it.
 */
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
