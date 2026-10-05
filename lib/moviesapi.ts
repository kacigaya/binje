import type { ResolveParams } from "@/lib/resolve-cache";
import {
  fetchJson,
  fetchText,
  firstInOrder,
  httpUrl,
  isPlayableManifest,
  isRecord,
  type ResolvedStream,
  UpstreamError,
} from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// MoviesAPI's player API requires an x-player-key header. The key is a
// constant in the player bundle, so it is read from there rather than copied
// here, and re-read when the API starts refusing it.
const ORIGIN = "https://moviesapi.to";
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);
const keyCache = createTtlCache<string>(60 * 60 * 1000, 1);

export function playerKeyFromBundle(bundle: string): string | undefined {
  return (
    /`([0-9a-f]{64})`,\w+=`\/api\/vidora\//.exec(bundle)?.[1] ??
    /["'`]([0-9a-f]{64})["'`]/.exec(bundle)?.[1]
  );
}

function playerKey(page: string) {
  return keyCache.get("key", async () => {
    const bundle = /\/assets\/index-[\w-]+\.js/.exec(await fetchText(page))?.[0];
    if (!bundle) throw new Error("MoviesAPI bundle not found.");
    const key = playerKeyFromBundle(await fetchText(`${ORIGIN}${bundle}`, { referer: page }));
    if (!key) throw new Error("MoviesAPI key not found.");
    return key;
  });
}

export function moviesapiStreams(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.sources)) return [];
  return body.sources.flatMap((source: unknown) => {
    if (!isRecord(source)) return [];
    const url = httpUrl(source.url);
    if (!url) return [];
    const tracks = Array.isArray(source.tracks)
      ? source.tracks.flatMap((track: unknown) => {
          if (!isRecord(track)) return [];
          const file = httpUrl(track.file);
          return file ? [{ file, label: typeof track.label === "string" ? track.label : undefined }] : [];
        })
      : [];
    return [{ url, tracks }];
  });
}

export function resolveMoviesapiStream({ type, id, season, episode }: ResolveParams): Promise<ResolvedStream> {
  const path = type === "tv" ? `tv/${id}/${season}/${episode}` : `movie/${id}`;
  return cache.get(path, async () => {
    const page = `${ORIGIN}/${path}`;
    let body: unknown;
    try {
      body = await fetchJson(`${ORIGIN}/api/vidora/v1/${path}`, {
        referer: page,
        headers: { "x-player-key": await playerKey(page) },
      });
    } catch (error) {
      if (error instanceof UpstreamError && (error.status === 401 || error.status === 403)) keyCache.clear();
      throw error;
    }
    const referer = `${ORIGIN}/`;
    const stream = await firstInOrder(
      moviesapiStreams(body).map(async (stream) => {
        if (!(await isPlayableManifest(stream.url, { referer }))) throw new Error("Unplayable stream.");
        return stream;
      }),
    );
    return { url: stream.url, tracks: stream.tracks, referer };
  });
}
