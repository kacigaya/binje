"use client";

import { useState, useEffect } from "react";
import { Button } from "@base-ui/react/button";
import { wouldTruncate } from "@/lib/pretext";
import type { FontKey } from "@/lib/pretext";

interface Props {
  text: string;
  fontKey: FontKey;
  fontSize: number;
  containerWidth: number;
  lineHeight: number;
  className?: string;
}

export default function ExpandableOverview({
  text,
  fontKey,
  fontSize,
  containerWidth,
  lineHeight,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    setIsTruncated(
      wouldTruncate(text, fontKey, fontSize, containerWidth, lineHeight, 3),
    );
  }, [text, fontKey, fontSize, containerWidth, lineHeight]);

  return (
    <div>
      <p
        className={`${className} ${!expanded && isTruncated ? "line-clamp-3" : ""}`}
      >
        {text}
      </p>
      {isTruncated && (
        <Button
          onClick={() => setExpanded(!expanded)}
          className="text-accent-red text-sm font-medium mt-1 hover:underline cursor-pointer"
        >
          {expanded ? "Show less" : "Read more"}
        </Button>
      )}
    </div>
  );
}
