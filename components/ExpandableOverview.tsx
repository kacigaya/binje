"use client";

import { useState } from "react";

interface Props {
  text: string;
  isTruncated: boolean;
  className?: string;
}

export default function ExpandableOverview({
  text,
  isTruncated,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <p
        className={`${className} ${!expanded && isTruncated ? "line-clamp-3" : ""}`}
      >
        {text}
      </p>
      {isTruncated && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-amber text-sm font-medium mt-1 hover:underline cursor-pointer"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
