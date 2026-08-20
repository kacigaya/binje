"use client";

import { Menu as BaseMenu, type MenuRoot } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import type { RefObject } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

type MenuItem = { value: string; label: string; selected?: boolean };

/**
 * Anchored menu with no trigger of its own, so a button can decide at click
 * time whether a choice is even needed.
 */
function Menu({
  open,
  onOpenChange,
  anchor,
  items,
  onSelect,
  ariaLabel,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: RefObject<HTMLElement | null>;
  items: MenuItem[];
  onSelect: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  // Base UI returns focus to its own trigger, and there is none here, so the
  // anchor has to take it back or closing strands focus on the document body.
  const returnFocus = useRef(false);

  function handleOpenChange(nextOpen: boolean, details: MenuRoot.ChangeEventDetails) {
    // A click outside moved focus deliberately; leave it alone.
    returnFocus.current = !nextOpen && details.reason !== "outside-press";
    onOpenChange(nextOpen);
  }

  function handleOpenChangeComplete(nextOpen: boolean) {
    if (nextOpen || !returnFocus.current) return;
    returnFocus.current = false;
    const button = anchor.current;
    if (button && document.activeElement !== button) button.focus();
  }

  return (
    <BaseMenu.Root
      open={open}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          anchor={anchor}
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-50 outline-none"
        >
          <BaseMenu.Popup
            aria-label={ariaLabel}
            className={cn(
              "max-h-72 min-w-48 overflow-y-auto rounded-2xl border border-white/10 bg-background/95 p-1 text-sm text-foreground shadow-lg shadow-black/40 backdrop-blur",
              className,
            )}
          >
            {items.map((item) => (
              <BaseMenu.Item
                key={item.value}
                onClick={() => onSelect(item.value)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-red/60 data-highlighted:bg-white/10"
              >
                <span className="truncate">{item.label}</span>
                {item.selected && <Check aria-hidden="true" className="size-3.5 text-accent-red" />}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export { Menu };
