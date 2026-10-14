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
    // Measure only while clamped; measuring expanded text would hide the collapse control.
    if (!el || expanded) return;

    // Column width changes can alter overflow and whether the toggle is needed.
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
          className="text-accent-red-text text-sm font-medium mt-1 rounded hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red/60"
        >
          {t(expanded ? "Show less" : "Read more")}
        </button>
      )}
    </div>
  );
}
