"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Check } from "lucide-react";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { cn } from "@/lib/utils";

type SelectItem<T> = { value: T; label: string };

function Select<T extends string | number>({
  value,
  onValueChange,
  items,
  ariaLabel,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: SelectItem<T>[];
  ariaLabel: string;
  className?: string;
}) {
  const [chevronIcon, chevronFeedback] = useAnimatedIcon();

  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      items={items}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        {...chevronFeedback}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60",
          className,
        )}
      >
        <BaseSelect.Value />
        <BaseSelect.Icon>
          <ChevronDownIcon ref={chevronIcon} size={14} className="text-white/70" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} className="z-50 outline-none">
          <BaseSelect.Popup className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-background/95 p-1 text-sm text-foreground shadow-lg shadow-black/40 backdrop-blur">
            {items.map((item) => (
              <BaseSelect.Item
                key={String(item.value)}
                value={item.value}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-red/60 data-highlighted:bg-white/10"
              >
                <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator>
                  <Check className="size-3.5 text-accent-red" />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

export { Select };
