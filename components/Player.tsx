"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StreamSource = {
  quality: string;
  url: string;
  provider?: string;
};

type Subtitle = {
  lang?: string;
  language?: string;
  url: string;
};

type PlayerResponse = {
  provider: string;
  sources: StreamSource[];
  subtitles: Subtitle[];
};

type HlsLevelSummary = {
  height?: number;
  width?: number;
  videoCodec?: string;
};

function qualityKey(quality: string) {
  const normalized = quality.toLowerCase();
  if (normalized.includes("4k") || normalized.includes("2160")) return "4k";
  if (normalized.includes("1080")) return "1080p";
  if (normalized.includes("720")) return "720p";
  if (normalized.includes("480")) return "480p";
  return normalized.trim();
}

function getSourceLabel(source: StreamSource, sources: StreamSource[]) {
  const hasDuplicateQuality =
    sources.filter((item) => qualityKey(item.quality) === qualityKey(source.quality))
      .length > 1;

  return hasDuplicateQuality && source.provider
    ? `${source.quality} ${source.provider}`
    : source.quality;
}

function findFallbackSource(
  sources: StreamSource[],
  currentSource: StreamSource,
  unavailableSources: Record<string, string>,
) {
  const availableSources = sources.filter(
    (source) => source.url !== currentSource.url && !unavailableSources[source.url],
  );
  const sameQualitySource = availableSources.find(
    (source) => qualityKey(source.quality) === qualityKey(currentSource.quality),
  );

  return sameQualitySource ?? availableSources[0] ?? null;
}

function hasVideoLevel(levels: HlsLevelSummary[]) {
  return levels.some(
    (level) => Boolean(level.videoCodec) || Boolean(level.height) || Boolean(level.width),
  );
}

function getDecodedVideoFrameCount(video: HTMLVideoElement) {
  const quality = video.getVideoPlaybackQuality?.();
  const webkitVideo = video as HTMLVideoElement & {
    webkitDecodedFrameCount?: number;
  };

  return quality?.totalVideoFrames ?? webkitVideo.webkitDecodedFrameCount ?? 0;
}

function getProxiedMediaUrl(url: string) {
  return `/api/hls?url=${encodeURIComponent(url)}`;
}

export default function Player({
  tmdbId,
  title,
  year,
  imdbId,
  type = "movie",
  season,
  episode,
}: {
  tmdbId: number;
  title: string;
  year?: number;
  imdbId?: string;
  type?: "movie" | "tv";
  season?: number;
  episode?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<PlayerResponse | null>(null);
  const [selectedSource, setSelectedSource] = useState<StreamSource | null>(null);
  const [unavailableSources, setUnavailableSources] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const playerUrl = useMemo(() => {
    const params = new URLSearchParams({
      tmdbId: String(tmdbId),
      title,
      type,
    });

    if (year) params.set("year", String(year));
    if (imdbId) params.set("imdbId", imdbId);
    if (type === "tv") {
      params.set("season", String(season ?? 1));
      params.set("episode", String(episode ?? 1));
    }

    return `/api/player?${params}`;
  }, [episode, imdbId, season, title, tmdbId, type, year]);

  const sources = useMemo(() => data?.sources ?? [], [data]);

  const markSourceUnavailable = useCallback(
    (source: StreamSource, reason: string) => {
      const nextUnavailableSources = {
        ...unavailableSources,
        [source.url]: reason,
      };
      const fallbackSource = findFallbackSource(sources, source, nextUnavailableSources);

      setUnavailableSources(nextUnavailableSources);

      if (fallbackSource) {
        setError(null);
        setNotice(
          `${getSourceLabel(source, sources)} is not compatible here. Trying ${getSourceLabel(
            fallbackSource,
            sources,
          )}.`,
        );
        setSelectedSource(fallbackSource);
      } else {
        setNotice(null);
        setError(reason);
      }
    },
    [sources, unavailableSources],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadStream() {
      setLoading(true);
      setError(null);
      setData(null);
      setNotice(null);
      setSelectedSource(null);
      setUnavailableSources({});

      try {
        const response = await fetch(playerUrl, { signal: controller.signal });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error || "Unable to load the stream.");
        }

        if (controller.signal.aborted) return;

        setData(body);
        setSelectedSource(body.sources[0] ?? null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load the stream.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadStream();

    return () => controller.abort();
  }, [playerUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedSource) return;

    let hls: Hls | null = null;
    let didFallback = false;
    let decodedFrameTimer: number | undefined;
    const sourceUrl = getProxiedMediaUrl(selectedSource.url);
    const sourceName = getSourceLabel(selectedSource, sources);
    const unsupportedReason = `${sourceName} has no browser-compatible video track.`;

    const fallbackFromSource = (reason: string) => {
      if (didFallback) return;
      didFallback = true;
      markSourceUnavailable(selectedSource, reason);
    };

    const verifyVideoTrack = () => {
      if (video.readyState > 0 && video.videoWidth === 0) {
        fallbackFromSource(unsupportedReason);
      }
    };

    const verifyDecodedFrames = () => {
      const initialFrameCount = getDecodedVideoFrameCount(video);

      window.clearTimeout(decodedFrameTimer);
      decodedFrameTimer = window.setTimeout(() => {
        const currentFrameCount = getDecodedVideoFrameCount(video);

        if (!video.paused && video.currentTime > 0 && currentFrameCount <= initialFrameCount) {
          fallbackFromSource(unsupportedReason);
        }
      }, 4000);
    };

    video.addEventListener("loadedmetadata", verifyVideoTrack);
    video.addEventListener("canplay", verifyVideoTrack);
    video.addEventListener("playing", verifyDecodedFrames);
    const videoVerificationTimer = window.setTimeout(verifyVideoTrack, 5000);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = sourceUrl;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        capLevelToPlayerSize: false,
      });
      hls.loadSource(sourceUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, eventData) => {
        if (!eventData.video || !hasVideoLevel(eventData.levels)) {
          fallbackFromSource(unsupportedReason);
        }
      });
      hls.on(Hls.Events.ERROR, (_event, eventData) => {
        if (!eventData.fatal || !hls) return;

        if (eventData.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad();
        } else if (eventData.type === Hls.ErrorTypes.MEDIA_ERROR) {
          fallbackFromSource(unsupportedReason);
        } else {
          fallbackFromSource("This stream cannot be played.");
          hls.destroy();
        }
      });
    } else {
      setError("This browser cannot play HLS streams.");
    }

    return () => {
      window.clearTimeout(videoVerificationTimer);
      window.clearTimeout(decodedFrameTimer);
      video.removeEventListener("loadedmetadata", verifyVideoTrack);
      video.removeEventListener("canplay", verifyVideoTrack);
      video.removeEventListener("playing", verifyDecodedFrames);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [markSourceUnavailable, selectedSource, sources]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black text-sm text-white/70">
          Loading stream...
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black px-6 text-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white">Player unavailable</p>
            <p className="text-xs text-white/60">{error}</p>
          </div>
        </div>
      )}

      {notice && !loading && !error && (
        <div className="absolute left-3 top-3 z-10 max-w-[70%] rounded-md bg-black/70 px-3 py-2 text-xs text-white/80 backdrop-blur">
          {notice}
        </div>
      )}

      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        controls
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
      >
        {data?.subtitles.map((subtitle, index) => {
          const label = subtitle.language || subtitle.lang || `Subtitle ${index + 1}`;

          return (
            <track
              key={`${subtitle.url}-${index}`}
              kind="subtitles"
              src={getProxiedMediaUrl(subtitle.url)}
              label={label}
              srcLang={(subtitle.lang || "en").slice(0, 2).toLowerCase()}
              default={index === 0 && label.toLowerCase().includes("english")}
            />
          );
        })}
      </video>

      {data && selectedSource && !loading && !error && (
        <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-md bg-black/70 p-1 backdrop-blur">
          {sources.length > 1 ? (
            sources.map((source) => {
              const isUnavailable = Boolean(unavailableSources[source.url]);
              const label = getSourceLabel(source, sources);

              return (
                <button
                  key={`${source.quality}-${source.url}`}
                  type="button"
                  disabled={isUnavailable}
                  title={isUnavailable ? unavailableSources[source.url] : label}
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    setSelectedSource(source);
                  }}
                  className={`h-7 rounded px-2 text-xs font-medium transition-colors ${
                    selectedSource.url === source.url
                      ? "bg-white text-black"
                      : "text-white/75 hover:bg-white/15 hover:text-white"
                  } ${isUnavailable ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {label}
                </button>
              );
            })
          ) : (
            <span className="grid h-7 place-items-center rounded bg-white px-2 text-xs font-medium text-black">
              {getSourceLabel(selectedSource, sources)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
