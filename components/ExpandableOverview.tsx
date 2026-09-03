"use client";

import { useState, useEffect, useId, useRef } from "react";
import { Button } from "@appica/ui-react/button";
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
        // Not an Appica Collapsible: collapsed here means two clamped lines,
        // not hidden content, and a Collapsible panel is all-or-nothing. The
        // clamp stays; only the control is the design system's.
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={textId}
          className="mt-1 -ml-2 text-primary hover:underline"
        >
          {t(expanded ? "Show less" : "Read more")}
        </Button>
      )}
    </div>
  );
}
