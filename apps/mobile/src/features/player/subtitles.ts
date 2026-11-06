import { apiRequest } from "../../api/client";
import { parseCues, type Cue } from "../../../../../lib/subtitle-timing";
import { buildResolveQuery, proxiedHlsUrl, type StreamMedia } from "./resolveStream";

export type { Cue };
/** `format: "srt"` files are converted to WebVTT by the server's HLS proxy. */
export type SubtitleTrack = { file: string; label?: string; format?: "srt" };

function isTrack(value: unknown): value is SubtitleTrack {
  if (typeof value !== "object" || value === null) return false;
  const { file, label, format } = value as Record<string, unknown>;
  return typeof file === "string" && /^https?:\/\//.test(file) &&
    (label === undefined || typeof label === "string") && (format === undefined || format === "srt");
}

/** Title-wide subtitles, offered like on the web when the playing source has none. */
export async function fetchTitleSubtitles(media: StreamMedia, signal?: AbortSignal): Promise<SubtitleTrack[]> {
  const result = await apiRequest<{ tracks?: unknown }>("/api/subtitles", { query: buildResolveQuery(media), signal });
  return Array.isArray(result.tracks) ? result.tracks.filter(isTrack) : [];
}

export function subtitleUrl(track: SubtitleTrack) {
  const url = proxiedHlsUrl(track.file);
  return track.format === "srt" ? `${url}&format=srt` : url;
}

// expo-video cannot load external subtitle files, so the player draws the cues itself.
export async function fetchCues(track: SubtitleTrack, signal?: AbortSignal): Promise<Cue[]> {
  const response = await fetch(subtitleUrl(track), { signal });
  if (!response.ok) throw new Error("Subtitles are unavailable.");
  return parseCues(await response.text());
}

/** Overlapping cues show together, in file order. */
export function activeCueText(cues: readonly Cue[], time: number) {
  return cues.filter((cue) => cue.start <= time && time < cue.end).map((cue) => cue.text).join("\n");
}

/** The first cue start or end after `time`. */
export function nextCueEdge(cues: readonly Cue[], time: number) {
  let edge: number | undefined;
  for (const cue of cues) {
    for (const value of [cue.start, cue.end]) if (value > time && (edge === undefined || value < edge)) edge = value;
  }
  return edge;
}

/** Providers repeat labels such as "English"; number the repeats like the web player. */
export function trackLabels(tracks: readonly SubtitleTrack[], fallback: (index: number) => string) {
  const counts = new Map<string, number>();
  return tracks.map((track, index) => {
    const label = track.label?.trim() || fallback(index + 1);
    const count = (counts.get(label) ?? 0) + 1;
    counts.set(label, count);
    return count > 1 ? `${label} ${count}` : label;
  });
}
