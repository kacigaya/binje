"use client";

import { Select as BaseSelect } from "@base-ui/react/select";
import { Check } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { GlassCard, GlassLayer } from "@/components/liquid-glass";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { useAnimatedIcon } from "@/lib/use-animated-icon";
import { cn } from "@/lib/utils";

type SelectItem<T> = { value: T; label: string };

function Select<T extends string | number>({
  value,
  onValueChange,
  items,
  ariaLabel,
  label,
  alignItemWithTrigger = true,
  icon,
  className,
  container,
  modal = true,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: SelectItem<T>[];
  ariaLabel: string;
  /** Visible prefix before the value; screen readers get `ariaLabel` instead. */
  label?: string;
  /** False drops the list below the trigger instead of over it. */
  alignItemWithTrigger?: boolean;
  /** Icon-only trigger: the icon replaces the visible value and chevron. */
  icon?: ReactNode;
  className?: string;
  /** Keep the popup inside a fullscreen element when provided. */
  container?: RefObject<HTMLElement | null>;
  modal?: boolean;
}) {
  const [chevronIcon, chevronFeedback] = useAnimatedIcon();

  return (
    <BaseSelect.Root
      modal={modal}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      items={items}
    >
      <BaseSelect.Trigger
        aria-label={ariaLabel}
        {...chevronFeedback}
        // Icon triggers sit inside the player's glass bar; a second lens there would melt into it.
        data-glass-host={icon ? undefined : ""}
        className={cn(
          "flex cursor-pointer items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60",
          className,
        )}
      >
        {!icon && <GlassLayer tint={0.15} />}
        {label && (
          <span aria-hidden="true" className="shrink-0 text-muted-foreground">
            {label}
          </span>
        )}
        {icon}
        <BaseSelect.Value className={icon ? "sr-only" : "truncate"} />
        {!icon && (
          <BaseSelect.Icon className="shrink-0">
            <ChevronDownIcon ref={chevronIcon} size={14} className="text-white/70" />
          </BaseSelect.Icon>
        )}
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={container}>
        {/* Absolute positioning can overflow before collision adjustment and widen Mobile Chrome's viewport. */}
        <BaseSelect.Positioner
          positionMethod="fixed"
          sideOffset={6}
          align={alignItemWithTrigger ? "center" : "start"}
          alignItemWithTrigger={alignItemWithTrigger}
          className="z-50 outline-none"
        >
          <BaseSelect.Popup render={<GlassCard />} className="flex max-h-72 flex-col overflow-hidden rounded-2xl text-sm text-foreground outline-none">
            <BaseSelect.List className="min-h-0 overflow-y-auto overscroll-contain p-1">
            {items.map((item) => (
              <BaseSelect.Item
                key={String(item.value)}
                value={item.value}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-red/60 data-highlighted:bg-white/10"
              >
                <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                <BaseSelect.ItemIndicator>
                  <Check className="size-3.5 text-foreground" />
                </BaseSelect.ItemIndicator>
              </BaseSelect.Item>
            ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

export { Select };
