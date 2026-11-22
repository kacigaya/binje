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

function firstTimeAfter(times: readonly number[], time: number) {
  let left = 0;
  let right = times.length;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (times[middle] > time) right = middle;
    else left = middle + 1;
  }
  return left;
}

export function indexCues(cuesByStart: readonly Cue[]) {
  let latestEnd = -Infinity;
  const ends = cuesByStart.map(({ end }) => (latestEnd = Math.max(latestEnd, end)));
  const edges = cuesByStart.flatMap(({ start, end }) => [start, end]).sort((a, b) => a - b);

  return (time: number) => {
    const lines: string[] = [];
    for (let index = firstTimeAfter(ends, time); index < cuesByStart.length; index++) {
      const cue = cuesByStart[index];
      if (cue.start > time) break;
      if (cue.end > time) lines.push(cue.text);
    }
    return { text: lines.join("\n"), edge: edges[firstTimeAfter(edges, time)] };
  };
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
