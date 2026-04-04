"use client";

import { useEffect, useRef } from "react";
import { getAdBlocker } from "@/lib/adblocker/blocker";

export default function Player({
  tmdbId,
  type = "movie",
  season,
  episode,
}: {
  tmdbId: number;
  type?: "movie" | "tv";
  season?: number;
  episode?: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  let src: string;
  if (type === "tv" && season !== undefined && episode !== undefined) {
    src = `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
  } else if (type === "tv") {
    src = `https://player.videasy.net/tv/${tmdbId}/1/1`;
  } else {
    src = `https://player.videasy.net/movie/${tmdbId}`;
  }

  // Initialize the ad blocker when the player mounts
  useEffect(() => {
    const blocker = getAdBlocker();
    blocker.start();

    return () => {
      blocker.stop();
    };
  }, []);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <iframe
        ref={iframeRef}
        src={src}
        className="absolute inset-0 w-full h-full"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="origin"
        title="Player"
      />
    </div>
  );
}
