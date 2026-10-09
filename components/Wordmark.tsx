import { cn } from "@/lib/utils";

/**
 * "b!nje" with the mark standing in for the "!": the bar, and its dot drawn as
 * a play button. Same glyph as `app/icon.svg` (cropped, no tile); change them
 * together. The hidden "!" keeps the name intact for screen readers and copy.
 */
export default function Wordmark({ className }: { className?: string }) {
  return (
    <span translate="no" className={cn("inline-flex items-baseline", className)}>
      {/* No tracking on the "b": its trailing letter-spacing would eat into
          the left gap and make it depend on the caller's tracking. */}
      <span className="tracking-normal">b</span>
      <span className="sr-only">!</span>
      {/* viewBox is cropped to the ink. Ink gaps: 0.11em after the "b" (0.044em
          side bearing + margin), ~0.085em before the "n" (~0.071em visible left
          space + margin), tighter on the right because the triangle tip reads
          as more open than the bar's straight edge. */}
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
