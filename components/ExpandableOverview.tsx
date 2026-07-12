"use client";

import { useState, useEffect, useRef } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    setIsTruncated(el.scrollHeight > el.clientHeight);
  }, [text]);

  return (
    <div>
      <p
        ref={textRef}
        className={`${className} ${expanded ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-accent-red text-sm font-medium mt-1 hover:underline cursor-pointer"
        >
          {t(expanded ? "Show less" : "Read more")}
        </button>
      )}
    </div>
  );
}
