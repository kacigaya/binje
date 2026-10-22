import type { PlaybackSource } from "../types/mobile-api";

// Vidcore starts first. This order breaks quality ties.
export const PLAYBACK_SOURCES = ["vidcore", "vidsu", "vidme", "vidru"] as const satisfies readonly PlaybackSource[];

export function isPlaybackSource(value: unknown): value is PlaybackSource {
  return typeof value === "string" && (PLAYBACK_SOURCES as readonly string[]).includes(value);
}

export function rankPlaybackSources(heights: Partial<Record<PlaybackSource, number>>): PlaybackSource[] {
  return PLAYBACK_SOURCES.filter((source) => heights[source] !== undefined)
    .sort((a, b) => (heights[b] ?? 0) - (heights[a] ?? 0));
}

export function selectPlaybackSource(
  available: readonly PlaybackSource[] | null | undefined,
  failed: readonly PlaybackSource[],
  playing?: PlaybackSource,
): PlaybackSource | null {
  const running = playing && !failed.includes(playing) ? playing : null;
  if (available == null && running) return running;
  const best = (available ?? PLAYBACK_SOURCES).find((source) => !failed.includes(source));
  // Keep playback running if the availability response omits its source.
  return best ?? running;
}
