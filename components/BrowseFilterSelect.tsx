"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * One browse filter as a dropdown. Each option's value is the full href the
 * server built for it, so URL state stays owned by `browseQuery`.
 */
export default function BrowseFilterSelect({
  label,
  value,
  items,
  active,
}: {
  label: string;
  value: string;
  items: { value: string; label: string }[];
  /** True when the filter differs from its default; outlines the trigger. */
  active: boolean;
}) {
  const router = useRouter();

  return (
    <Select
      ariaLabel={label}
      label={label}
      alignItemWithTrigger={false}
      value={value}
      items={items}
      onValueChange={(href) => router.push(href, { scroll: false })}
      className={cn(
        "h-9 max-w-full min-w-0 gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-foreground" : "border-white/15 hover:bg-white/10",
      )}
    />
  );
}
