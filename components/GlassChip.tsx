import type { ComponentProps } from "react";
import { GlassLayer, type GlassMaterial } from "@/components/liquid-glass";
import { cn } from "@/lib/utils";

/** A still glass pill for ratings and labels. Tinted glass takes its colour from a `bg-*` class. */
export default function GlassChip({
  material = "clear",
  className,
  children,
  ...props
}: ComponentProps<"span"> & { material?: GlassMaterial }) {
  return (
    <span
      data-glass-host=""
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5",
        material === "clear" && "border border-white/15 bg-white/10 backdrop-blur-md",
        className,
      )}
      {...props}
    >
      <GlassLayer material={material} tint={0.2} swell={false} pull={false} />
      {children}
    </span>
  );
}
