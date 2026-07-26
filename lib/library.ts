// Library catalog: each title carries an index.json manifest in storage that
// lists its renditions and subtitle tracks. One fetch per resolve, no probing.

export type Rendition = { height: number; file: string };
export type SubtitleTrack = { file: string; label?: string };
export type LibraryManifest = {
  renditions: Rendition[];
  subtitles: SubtitleTrack[];
};
export type ResolverResult = {
  url: string;
  tracks: SubtitleTrack[];
  sources?: Rendition[];
};

export type LibraryRequest = {
  type: "movie" | "tv";
  id: string;
  season?: string;
  episode?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function manifestKey({ type, id, season, episode }: LibraryRequest) {
  return type === "tv"
    ? `tv/${id}/s${season ?? "1"}e${episode ?? "1"}/index.json`
    : `movies/${id}/index.json`;
}

export function parseLibraryManifest(value: unknown): LibraryManifest {
  if (!isRecord(value) || !Array.isArray(value.renditions)) {
    throw new Error("Invalid library manifest.");
  }

  const renditions = value.renditions
    .flatMap((item) => {
      if (!isRecord(item) || typeof item.file !== "string" || !item.file) return [];
      const height = Number(item.height);
      return Number.isInteger(height) && height > 0
        ? [{ file: item.file, height }]
        : [];
    })
    .sort((a, b) => b.height - a.height);
  if (renditions.length === 0) throw new Error("Manifest has no renditions.");

  const labels = new Set<string>();
  const subtitles = Array.isArray(value.subtitles)
    ? value.subtitles.flatMap((item) => {
        if (!isRecord(item) || typeof item.file !== "string" || !item.file) return [];
        const label = typeof item.label === "string" ? item.label : undefined;
        if (label && labels.has(label)) return [];
        if (label) labels.add(label);
        return [{ file: item.file, ...(label ? { label } : {}) }];
      })
    : [];

  return { renditions, subtitles };
}

/**
 * Maps a manifest onto the wire contract the player already speaks. Default
 * playback targets 1080p when present, matching the previous resolver.
 */
export function toResolverResult(
  manifest: LibraryManifest,
  toUrl: (file: string) => string,
): ResolverResult {
  const sources = manifest.renditions.map(({ height, file }) => ({
    height,
    file: toUrl(file),
  }));
  const preferred = sources.find(({ height }) => height === 1080) ?? sources[0];

  return {
    url: preferred.file,
    tracks: manifest.subtitles.map(({ file, label }) => ({
      file: toUrl(file),
      ...(label ? { label } : {}),
    })),
    ...(sources.length > 1 ? { sources } : {}),
  };
}
