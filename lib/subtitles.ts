import { allowStreamHosts } from "@/lib/hls-hosts";
import type { ResolveParams } from "@/lib/stream-check";
import { fetchJson, httpUrl, isRecord } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// `format: "srt"` files are converted to WebVTT by /api/hls.
export type SubtitleTrack = { file: string; label?: string; format?: "srt" };

const cache = createTtlCache<SubtitleTrack[]>(10 * 60 * 1000);
// OpenSubtitles' legacy REST API asks clients to name themselves.
const OPENSUBTITLES_AGENT = "binje";

// Keep alternate release timings per language so viewers can try another file when one drifts.
// Normalize labels such as English2 and English hi to a language; the player numbers repeats.
export function pickSubtitleTracks(tracks: SubtitleTrack[]): SubtitleTrack[] {
  const seenFiles = new Set<string>();
  return tracks.flatMap((track) => {
    const language = track.label?.trim().replace(/\s*hi\d*$/i, "").replace(/\s*\d+$/, "");
    if (!language || seenFiles.has(track.file)) return [];
    seenFiles.add(track.file);
    return [{ ...track, label: language }];
  });
}

// WebVTT by TMDB id, also used by the Atlantic family.
async function graniteSubtitles({ type, id, season, episode }: ResolveParams): Promise<SubtitleTrack[]> {
  const path = type === "tv" ? `tv/${id}/${season}/${episode}` : `movie/${id}`;
  const body = await fetchJson(`https://sub.vdrk.site/v1/${path}`);
  return Array.isArray(body)
    ? body.flatMap((item) => {
        const file = isRecord(item) ? httpUrl(item.file) : undefined;
        return file && typeof item.label === "string" ? [{ file, label: item.label }] : [];
      })
    : [];
}

// SRT by IMDb id; a show's id with season and episode for TV.
export function openSubtitlesTracks(body: unknown): SubtitleTrack[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((item) => {
    if (!isRecord(item) || item.SubFormat !== "srt" || typeof item.LanguageName !== "string") return [];
    if (typeof item.SubDownloadLink !== "string") return [];
    // The UTF-8 variant of the link answers uncompressed text in one encoding.
    const file = httpUrl(item.SubDownloadLink.replace(/\.gz$/, "").replace("/download/", "/download/subencoding-utf8/"));
    if (!file || new URL(file).hostname !== "dl.opensubtitles.org") return [];
    return [{ file, label: item.LanguageName, format: "srt" as const }];
  });
}

async function openSubtitles({ type, imdbId, season, episode }: ResolveParams): Promise<SubtitleTrack[]> {
  const id = `imdbid-${imdbId.slice(2)}`;
  const path = type === "tv" ? `episode-${episode}/${id}/season-${season}` : id;
  const body = await fetchJson(`https://rest.opensubtitles.org/search/${path}`, {
    userAgent: OPENSUBTITLES_AGENT,
    headers: { "x-user-agent": OPENSUBTITLES_AGENT },
  });
  return openSubtitlesTracks(body);
}

// Offer title-wide subtitles alongside the playing source's tracks; WebVTT precedes OpenSubtitles SRT.
export async function titleSubtitles(params: ResolveParams): Promise<SubtitleTrack[]> {
  const key = params.type === "tv" ? `tv:${params.id}:${params.season}:${params.episode}` : `movie:${params.id}`;
  const tracks = await cache.get(key, async () => {
    const lists = await Promise.allSettled([
      graniteSubtitles(params),
      // It searches by IMDb id only; without one it is not asked at all.
      ...(params.imdbId ? [openSubtitles(params)] : []),
    ]);
    // A full outage must not be cached as "no subtitles"; a rejection is not.
    if (lists.every((list) => list.status === "rejected")) throw new Error("No subtitle provider answered.");
    return pickSubtitleTracks(lists.flatMap((list) => (list.status === "fulfilled" ? list.value : [])));
  });
  // Re-register file hosts on every call because the proxy allowlist expires independently.
  allowStreamHosts(tracks.map((track) => track.file));
  return tracks;
}
