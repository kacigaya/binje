import type { VideoTrack } from "expo-video";

export type Quality = { height: number; url: string };

/**
 * Lists the HLS variants of a master playlist, one per height, like the web player does with hls.js levels.
 * The `/api/hls` proxy rewrites variant URIs, so each track URL is already playable as is.
 */
export function playlistQualities(tracks: readonly Pick<VideoTrack, "url" | "size" | "peakBitrate" | "averageBitrate">[]): Quality[] {
  const best = new Map<number, { url: string; bitrate: number }>();
  for (const track of tracks) {
    const height = track.size?.height;
    if (!track.url || !height) continue;
    const bitrate = track.peakBitrate ?? track.averageBitrate ?? 0;
    const current = best.get(height);
    if (!current || bitrate > current.bitrate) best.set(height, { url: track.url, bitrate });
  }
  // A single variant means a media playlist, not a choice.
  if (best.size < 2) return [];
  return [...best].map(([height, { url }]) => ({ height, url })).sort((a, b) => b.height - a.height);
}
