import type { MediaLoadRequest } from "react-native-google-cast";
import { apiRequest, configuredBaseUrl, normalizeBaseUrl } from "../../api/client";

export type CastTrack = { file: string; label?: string };

export function castProxyUrl(source: string, token: string, baseUrl = configuredBaseUrl()) {
  const url = new URL("/api/hls", `${normalizeBaseUrl(baseUrl)}/`);
  url.searchParams.set("url", source);
  url.searchParams.set("castToken", token);
  return url.toString();
}

export async function requestCastToken(signal?: AbortSignal) {
  const response = await apiRequest<{ token?: unknown }>("/api/cast", {
    method: "POST",
    signal,
  });
  if (typeof response.token !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(response.token)) {
    throw new Error("Invalid Cast authorization response.");
  }
  return response.token;
}

export function createCastLoadRequest({
  source,
  token,
  title,
  tracks,
  startTime,
  duration,
  autoplay,
  baseUrl,
}: {
  source: string;
  token: string;
  title: string;
  tracks: CastTrack[];
  startTime: number;
  duration?: number;
  autoplay: boolean;
  baseUrl?: string;
}): MediaLoadRequest {
  return {
    autoplay,
    startTime: Number.isFinite(startTime) && startTime > 0 ? startTime : 0,
    mediaInfo: {
      contentUrl: castProxyUrl(source, token, baseUrl),
      contentType: "application/vnd.apple.mpegurl",
      metadata: { type: "generic", title },
      ...(duration !== undefined && Number.isFinite(duration) && duration > 0
        ? { streamDuration: duration }
        : {}),
      mediaTracks: tracks.map((track, index) => ({
        id: index + 1,
        type: "text",
        subtype: "subtitles",
        contentId: castProxyUrl(track.file, token, baseUrl),
        contentType: "text/vtt",
        language: "und",
        name: track.label ?? `Subtitles ${index + 1}`,
      })),
    },
  };
}
