"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { measureLines, type FontKey } from "@/lib/pretext";

interface UseTextLayoutOptions {
  text: string;
  fontKey: FontKey;
  fontSize: number;
  lineHeight: number;
  maxLines?: number;
}

interface TextLayoutResult {
  lineCount: number;
  height: number;
  isTruncated: boolean;
  containerRef: React.RefCallback<HTMLElement>;
}

export function useTextLayout({
  text,
  fontKey,
  fontSize,
  lineHeight,
  maxLines = Infinity,
}: UseTextLayoutOptions): TextLayoutResult {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const containerRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (node) {
      setWidth(node.clientWidth);
      observerRef.current = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setWidth(entry.contentRect.width);
        }
      });
      observerRef.current.observe(node);
    }
  }, []);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  if (width === 0) {
    return { lineCount: 0, height: 0, isTruncated: false, containerRef };
  }

  const { lineCount, height } = measureLines(
    text,
    fontKey,
    fontSize,
    width,
    lineHeight,
  );

  return {
    lineCount,
    height,
    isTruncated: lineCount > maxLines,
    containerRef,
  };
}
