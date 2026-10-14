import { cn } from "@/lib/utils";

/** Keep the glyph in sync with `app/icon.svg`.
 * The hidden "!" preserves the name for screen readers and copying. */
export default function Wordmark({ className }: { className?: string }) {
  return (
    <span translate="no" className={cn("inline-flex items-baseline", className)}>
      {/* Remove trailing tracking from "b" so callers cannot change the gap before the mark. */}
      <span className="tracking-normal">b</span>
      <span className="sr-only">!</span>
      {/* Crop the viewBox to the ink; gaps are 0.11em after "b" and about 0.085em before "n".
       * The triangle needs a tighter right gap because its tip appears more open than the bar. */}
      <svg
        viewBox="216 88 100 348"
        aria-hidden="true"
        className="ml-[0.066em] mr-[0.015em] text-accent-red"
        // Cap height of the heading face, so the glyph sits like a letter.
        style={{ height: "0.7em", width: "auto" }}
      >
        <g fill="currentColor" stroke="currentColor" strokeLinejoin="round">
          <rect x="216" y="88" width="80" height="220" rx="40" stroke="none" />
          <path d="M236 346 L236 426 L306 386 Z" strokeWidth="20" />
        </g>
      </svg>
      nje
    </span>
  );
}
