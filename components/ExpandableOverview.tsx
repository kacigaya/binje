"use client";

import { useState, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-locale";

interface Props {
  text: string;
  className?: string;
}

export default function ExpandableOverview({
  text,
  className,
}: Props) {
  const { t } = useTranslations();
  const textRef = useRef<HTMLParagraphElement>(null);
  const textId = useId();
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    // Only the clamped state can be measured: expanded, the overflow is gone
    // by definition and re-measuring would hide the control that undoes it.
    if (!el || expanded) return;

    // The clamp depends on the column width, so a rotation or a window resize
    // can add or remove the overflow that decides whether the toggle shows.
    const measure = () => setIsTruncated(el.scrollHeight > el.clientHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <div>
      <p
        ref={textRef}
        id={textId}
        className={cn("text-pretty", className, !expanded && "line-clamp-2")}
      >
        {text}
      </p>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={textId}
          className="text-accent-red text-sm font-medium mt-1 rounded hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
        >
          {t(expanded ? "Show less" : "Read more")}
        </button>
      )}
    </div>
  );
}
