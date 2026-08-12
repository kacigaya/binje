"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const scores = new Map<string, number | null>();

export default function RottenTomatoesRating({
  imdbId,
}: {
  imdbId: string | null | undefined;
}) {
  const [result, setResult] = useState<{
    imdbId: string;
    score: number | null;
  } | null>(null);

  useEffect(() => {
    if (!imdbId) return;
    let cancelled = false;
    if (scores.has(imdbId)) {
      Promise.resolve(scores.get(imdbId) ?? null).then((cachedScore) => {
        if (!cancelled) setResult({ imdbId, score: cachedScore });
      });
      return () => {
        cancelled = true;
      };
    }

    const controller = new AbortController();
    fetch(`/api/ratings/rt?imdbId=${encodeURIComponent(imdbId)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { score: null }))
      .then(({ score: nextScore }: { score: number | null }) => {
        scores.set(imdbId, nextScore);
        if (!cancelled) setResult({ imdbId, score: nextScore });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [imdbId]);

  // The id guard keeps a previous item's score off the next one while the
  // hero rotates; without the explicit null test both sides are undefined
  // before the first fetch resolves.
  const score = result && result.imdbId === imdbId ? result.score : null;
  if (score === null) return null;

  return (
    <div className="flex items-center gap-1.5 font-semibold text-accent-red">
      <Image
        src="/rotten-tomatoes.svg"
        alt=""
        width={16}
        height={16}
        aria-hidden="true"
        className="size-4 shrink-0"
      />
      <span className="text-sm">{score}%</span>
    </div>
  );
}
