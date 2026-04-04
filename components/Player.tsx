"use client";

import { useState } from "react";
import { ExternalLink, Shield } from "lucide-react";

function PlayerFrame({ src, adGuardDoH }: { src: string; adGuardDoH: string }) {
  const [iframeEnabled, setIframeEnabled] = useState(false);

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
        <iframe
          src={src}
          className={`absolute inset-0 w-full h-full ${
            iframeEnabled ? "pointer-events-auto" : "pointer-events-none"
          }`}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="origin"
          title="Player"
        />

        {!iframeEnabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-xs">
            <div className="text-center px-4 max-w-md space-y-3">
              <p className="text-sm sm:text-base text-foreground/90">
                Click once to enable the player. This first click stays in-app to
                reduce popup triggers from the embed.
              </p>
              <button
                onClick={() => setIframeEnabled(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-accent-red text-white text-sm font-medium hover:bg-accent-red/90 transition-colors cursor-pointer"
              >
                Enable Player
              </button>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs sm:text-sm text-foreground/70 hover:text-foreground transition-colors"
              >
                Open player in new tab
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-accent-red" />
        <span>
          For stronger ad blocking, configure DNS-over-HTTPS to
          <span className="text-foreground"> dns.adguard-dns.com</span>.
        </span>
        <a
          href={adGuardDoH}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground"
        >
          Endpoint
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

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
  let src: string;
  if (type === "tv" && season !== undefined && episode !== undefined) {
    src = `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
  } else if (type === "tv") {
    src = `https://player.videasy.net/tv/${tmdbId}/1/1`;
  } else {
    src = `https://player.videasy.net/movie/${tmdbId}`;
  }

  const adGuardDoH = "https://dns.adguard-dns.com/dns-query";
  return <PlayerFrame key={src} src={src} adGuardDoH={adGuardDoH} />;
}
