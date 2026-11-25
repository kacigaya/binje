"use client";

import { Popover } from "@base-ui/react/popover";
import { Check } from "lucide-react";
import { Languages } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useId, type RefObject } from "react";
import AudioLanguageIcon from "@/components/AudioLanguageIcon";
import { controlButtonClass } from "@/components/PlayerControls";
import { useTranslations } from "@/lib/use-locale";

export default function AudioMenu({
  container, value, onSelect, pending, frenchUnavailable, disabled, originalLanguage,
}: {
  container: RefObject<HTMLElement | null>;
  value: "vo" | "vf";
  onSelect: (value: "vo" | "vf") => void;
  pending: boolean;
  frenchUnavailable: boolean;
  disabled: boolean;
  originalLanguage?: string;
}) {
  const { t } = useTranslations();
  const name = useId();

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t("Audio")}
        title={t("Audio")}
        aria-busy={pending}
        disabled={disabled}
        className={controlButtonClass}
      >
        <MorphIcon icon={Languages} aria-hidden="true" reducedMotion="user" />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner positionMethod="fixed" sideOffset={8} collisionPadding={8} className="z-50 outline-none">
          <Popover.Popup className="max-h-[var(--available-height)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-white/10 bg-popover text-sm text-foreground shadow-lg shadow-black/40 outline-none">
            <Popover.Title className="sr-only">{t("Audio")}</Popover.Title>
            <fieldset className="min-w-0 p-1" disabled={disabled}>
              <legend className="sr-only">{t("Audio")}</legend>
              {(["vo", "vf"] as const).map((version) => (
                <label
                  key={version}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white/10 has-disabled:cursor-not-allowed has-disabled:opacity-50 has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-accent-red/60"
                >
                  <input
                    type="radio"
                    name={name}
                    checked={value === version}
                    disabled={version === "vf" && frenchUnavailable}
                    onClick={() => {
                      // A failed French source can show VO while the saved choice is still VF.
                      if (value === version) onSelect(version);
                    }}
                    onChange={() => onSelect(version)}
                    className="sr-only"
                  />
                  <AudioLanguageIcon language={version === "vo" ? originalLanguage : "fr"} />
                  <span className="flex-1">{version === "vo" ? t("Original audio") : t("French audio")}</span>
                  {value === version && <Check aria-hidden="true" className="size-3.5 shrink-0" />}
                </label>
              ))}
            </fieldset>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
