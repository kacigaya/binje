import type { ResolveParams } from "@/lib/resolve-cache";
import {
  fetchJson,
  fetchText,
  firstInOrder,
  httpUrl,
  isPlayableManifest,
  isRecord,
  type ResolvedStream,
} from "@/lib/stream-check";
import { getMovieDetails, getTVDetails } from "@/lib/tmdb";
import { createTtlCache } from "@/lib/ttl-cache";

// Athena returns plain URLs; stream.hls.lol uses prefixed hex nonce||AES-GCM with bundled keys.
// Turnstile is page-only; skip disabled Shegu and Aphrodite, which serves decoys without X-Az-* signatures.
// The /planets servers (Saturn, Neptune) are gone: their payloads no longer decrypt with the
// published key and the site itself no longer asks for them.
const SITE = "https://atlantic.st/";
const API = "https://stream.hls.lol";
const ATHENA = "https://zcdn.bluevelvet.space";
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);
// Pandora matches titles in English, which binje's own params are not.
const englishTitles = createTtlCache<{ title: string; year: string }>(24 * 60 * 60 * 1000);

export type AtlanticServer = "athena" | "helios" | "pandora" | "moscow";

const WRAPPED = {
  helios: { path: "helios", prefix: "hl_", key: "117c358bcfcaf8fe2cfca57c9d2238a300e1c4de2efb83a5012ba84d8a31f1dd", name: "Moscow" },
  moscow: { path: "moscow", prefix: "ms_", key: "55060a042823f51a94c296894a58a0db15f3baef807155140983083fa799ef47", name: "Moscow" },
} as const;
const PANDORA_KEY = "44730e0f65f1932ac6d76827239c901cc231b10520efa120ed324314eb4ca6a8";

function hexBytes(value: string) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("Invalid Atlantic payload.");
  return Uint8Array.from(value.match(/../g) ?? [], (byte) => parseInt(byte, 16));
}

// A value without the server's prefix is already a URL.
export async function unwrapAtlanticUrl(value: string, prefix: string, keyHex: string): Promise<string | undefined> {
  if (!value.startsWith(prefix)) return httpUrl(value);
  const bytes = hexBytes(value.slice(prefix.length));
  if (bytes.length < 28) throw new Error("Invalid Atlantic payload.");
  const key = await crypto.subtle.importKey("raw", hexBytes(keyHex), { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return httpUrl(new TextDecoder().decode(plain));
}

// `{ sources: { Name: { url } } }`, in the server's own order of names.
export function atlanticSourceValues(body: unknown, names: readonly string[]): string[] {
  const sources = isRecord(body) && isRecord(body.sources) ? body.sources : {};
  return names.flatMap((name) => {
    const source = sources[name];
    return isRecord(source) && typeof source.url === "string" && source.url ? [source.url] : [];
  });
}

// The single-source answer carries its payload under "hls" now and used to
// carry it under "dash"; both names are still in the wild.
export function atlanticStreamPayload(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  if (typeof body.hls === "string") return body.hls;
  if (typeof body.dash === "string") return body.dash;
  return undefined;
}

export function atlanticQuery(server: "athena" | "wrapped", { type, id, season, episode }: ResolveParams) {
  const query = new URLSearchParams(server === "athena" ? { tmdb: id, type } : { tmdbId: id, type });
  if (type === "tv") {
    query.set(server === "athena" ? "season" : "seasonId", season);
    query.set(server === "athena" ? "episode" : "episodeId", episode);
  }
  return query;
}

function englishTitle({ type, id }: ResolveParams) {
  return englishTitles.get(`${type}:${id}`, async () => {
    if (type === "tv") {
      const show = await getTVDetails(Number(id), "en");
      return { title: show.name, year: show.first_air_date?.slice(0, 4) ?? "" };
    }
    const movie = await getMovieDetails(Number(id), "en");
    return { title: movie.title, year: movie.release_date?.slice(0, 4) ?? "" };
  });
}

// Untrusted callers get a "disable Cloudflare Warp" card padded to the episode's length,
// so it passes the duration check. It claims HD, yet its whole ladder stays under 1 Mbps.
export function isAtlanticDecoy(manifest: string) {
  const variants = [...manifest.matchAll(/#EXT-X-STREAM-INF:([^\n]*)/g)].map(([, attrs]) => ({
    height: Number(attrs.match(/RESOLUTION=\d+x(\d+)/)?.[1]),
    bandwidth: Number(attrs.match(/(?:^|,)BANDWIDTH=(\d+)/)?.[1]),
  }));
  return (
    variants.some(({ height }) => height >= 1080) &&
    variants.every(({ bandwidth }) => bandwidth < 1_000_000)
  );
}

async function candidates(server: AtlanticServer, params: ResolveParams): Promise<string[]> {
  if (server === "athena") {
    const body = await fetchJson(`${ATHENA}/cdn?${atlanticQuery("athena", params)}`, { referer: SITE });
    const url = isRecord(body) && body.ready === true ? httpUrl(body.url) : undefined;
    // Athena answers every title with the same short promo when it distrusts the caller.
    return url && !new URL(url).pathname.startsWith("/promo/") ? [url] : [];
  }
  if (server === "pandora") {
    const { title, year } = await englishTitle(params);
    const query = atlanticQuery("wrapped", params);
    query.set("t", title);
    if (year) query.set("ry", year);
    const body = await fetchJson(`${API}/pandora?${query}`, { referer: SITE });
    const payload = atlanticStreamPayload(body);
    const url = payload ? await unwrapAtlanticUrl(payload, "pd_", PANDORA_KEY) : undefined;
    return url ? [url] : [];
  }
  const { path, prefix, key, name } = WRAPPED[server];
  const query = atlanticQuery("wrapped", params);
  const body = await fetchJson(`${API}/${path}?${query}`, { referer: SITE });
  const urls = await Promise.all(atlanticSourceValues(body, [name]).map((value) => unwrapAtlanticUrl(value, prefix, key)));
  return urls.filter((url) => url !== undefined);
}

// Pandora is DASH (HEVC), which /api/hls translates to HLS. Several CDNs
// answer only with Atlantic as Referer; the others accept it.
export function resolveAtlanticStream(server: AtlanticServer) {
  return (params: ResolveParams): Promise<ResolvedStream> => {
    const key = `${server}:${params.type}:${params.id}:${params.season}:${params.episode}`;
    return cache.get(key, async () => {
      const url = await firstInOrder(
        (await candidates(server, params)).map(async (url) => {
          if (isAtlanticDecoy(await fetchText(url, { referer: SITE }))) throw new Error("Decoy stream.");
          if (!(await isPlayableManifest(url, { referer: SITE }))) throw new Error("Unplayable stream.");
          return url;
        }),
      );
      return { url, tracks: [], referer: SITE };
    });
  };
}
