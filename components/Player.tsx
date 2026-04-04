"use client";

import { useState, useEffect, useCallback } from "react";

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
  const [showOverlay, setShowOverlay] = useState(true);

  let src: string;
  if (type === "tv" && season !== undefined && episode !== undefined) {
    src = `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
  } else if (type === "tv") {
    src = `https://player.videasy.net/tv/${tmdbId}/1/1`;
  } else {
    src = `https://player.videasy.net/movie/${tmdbId}`;
  }

  // Block popup windows opened by the iframe
  useEffect(() => {
    const originalOpen = window.open;
    window.open = function (...args) {
      // Block popups from ad scripts
      return null;
    };
    return () => {
      window.open = originalOpen;
    };
  }, []);

  // Re-show overlay periodically to catch repeated ad triggers
  const handleOverlayClick = useCallback(() => {
    setShowOverlay(false);
    // Re-enable overlay after a short delay to catch the next ad click
    setTimeout(() => setShowOverlay(true), 3000);
  }, []);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        allowFullScreen
        allow="autoplay; fullscreen; picture-in-picture"
        referrerPolicy="origin"
        title="Player"
      />
      {showOverlay && (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={handleOverlayClick}
        />
      )}
    </div>
  );
}
