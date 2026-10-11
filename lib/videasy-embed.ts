// Iframe player documented at https://videasy.ws/docs.html. Unlike the HLS
// sources it is neither resolved nor proxied by this server: the viewer's
// browser loads it directly, with its own scripts.
export const VIDEASY_EMBED_ORIGIN = "https://player.videasy.ws";

type EmbedMedia = {
  type: "movie" | "tv";
  id: number;
  season?: number;
  episode?: number;
};

export function videasyEmbedUrl(media: EmbedMedia, startAt: number | null) {
  const path =
    media.type === "tv"
      ? `/embed/tv/${media.id}/${media.season ?? 1}/${media.episode ?? 1}`
      : `/embed/movie/${media.id}`;
  const url = new URL(path, VIDEASY_EMBED_ORIGIN);
  url.searchParams.set("autoplay", "1");
  if (startAt !== null && startAt > 0) url.searchParams.set("startAt", String(Math.floor(startAt)));
  return url.href;
}

function toNumber(value: unknown) {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
}

// Reads a PLAYER_EVENT message, sent as an object or a JSON string. Progress
// for a different title or episode (the frame can navigate on its own) is
// dropped so it is not saved against the one this page shows.
export function parseVideasyEmbedProgress(
  message: unknown,
  media: EmbedMedia,
): { positionSeconds: number; durationSeconds: number } | null {
  let parsed = message;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const envelope = parsed as { type?: unknown; data?: unknown };
  if (envelope.type !== "PLAYER_EVENT" || !envelope.data || typeof envelope.data !== "object") return null;

  const data = envelope.data as Record<string, unknown>;
  const info = (data.player_info && typeof data.player_info === "object" ? data.player_info : {}) as Record<
    string,
    unknown
  >;
  const tmdb = toNumber(info.tmdb);
  if (tmdb !== null && tmdb !== media.id) return null;
  if (media.type === "tv") {
    const season = toNumber(info.season);
    const episode = toNumber(info.episode);
    if (season !== null && season !== (media.season ?? 1)) return null;
    if (episode !== null && episode !== (media.episode ?? 1)) return null;
  }

  const positionSeconds = toNumber(data.player_progress);
  const durationSeconds = toNumber(data.player_duration);
  if (positionSeconds === null || durationSeconds === null) return null;
  return { positionSeconds, durationSeconds };
}
