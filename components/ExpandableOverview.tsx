"use client";

import { useState, useEffect } from "react";
import { wouldTruncate } from "@/lib/pretext";
import type { FontKey } from "@/lib/pretext";

interface Props {
  text: string;
  fontKey: FontKey;
  fontSize: number;
  containerWidth: number;
  lineHeight: number;
  maxLines: number;
  className?: string;
}

export default function ExpandableOverview({
  text,
  fontKey,
  fontSize,
  containerWidth,
  lineHeight,
  maxLines,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    setIsTruncated(wouldTruncate(text, fontKey, fontSize, containerWidth, lineHeight, maxLines));
  }, [text, fontKey, fontSize, containerWidth, lineHeight, maxLines]);

  return (
    <div>
      <p
        className={`${className} ${!expanded && isTruncated ? `line-clamp-${maxLines}` : ""}`}
      >
        {text}
      </p>
      {isTruncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-accent-red text-sm font-medium mt-1 hover:underline cursor-pointer"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
