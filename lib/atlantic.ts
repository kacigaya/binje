import type { ResolveParams } from "@/lib/resolve-cache";
import {
  fetchJson,
  firstInOrder,
  httpUrl,
  isPlayableManifest,
  isRecord,
  type ResolvedStream,
} from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// Servers from atlantic.st's player. Athena answers with a plain master URL;
// the stream.hls.lol servers wrap theirs as `<prefix><hex nonce||AES-GCM>`
// under keys that ship in Atlantic's bundle. The site's Turnstile check runs
// in its page only; none of these endpoints asks for it. Its Shegu (disabled),
// Pandora (DASH, title matching) and Aphrodite (signed session headers)
// servers are not used.
const SITE = "https://atlantic.st/";
const API = "https://stream.hls.lol";
const ATHENA = "https://zcdn.bluevelvet.space";
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);

export type AtlanticServer = "athena" | "helios" | "moscow" | "planets";

const WRAPPED = {
  helios: { prefix: "hl_", key: "117c358bcfcaf8fe2cfca57c9d2238a300e1c4de2efb83a5012ba84d8a31f1dd", names: ["Moscow"] },
  moscow: { prefix: "ms_", key: "55060a042823f51a94c296894a58a0db15f3baef807155140983083fa799ef47", names: ["Moscow"] },
  planets: { prefix: "pl_", key: "d31157f286118352b140326486d7da7fdce1b8f2e30d376ab33af875b7c9a80f", names: ["Saturn", "Neptune"] },
} as const;

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

export function atlanticQuery(server: AtlanticServer, { type, id, season, episode }: ResolveParams) {
  const query = new URLSearchParams(server === "athena" ? { tmdb: id, type } : { tmdbId: id, type });
  if (type === "tv") {
    query.set(server === "athena" ? "season" : "seasonId", season);
    query.set(server === "athena" ? "episode" : "episodeId", episode);
  }
  return query;
}

async function candidates(server: AtlanticServer, params: ResolveParams): Promise<string[]> {
  const query = atlanticQuery(server, params);
  if (server === "athena") {
    const body = await fetchJson(`${ATHENA}/cdn?${query}`, { referer: SITE });
    const url = isRecord(body) && body.ready === true ? httpUrl(body.url) : undefined;
    return url ? [url] : [];
  }
  const { prefix, key, names } = WRAPPED[server];
  const body = await fetchJson(`${API}/${server}?${query}`, { referer: SITE });
  const urls = await Promise.all(atlanticSourceValues(body, names).map((value) => unwrapAtlanticUrl(value, prefix, key)));
  return urls.filter((url) => url !== undefined);
}

// Moscow and Planets answer only with Atlantic as Referer; the others accept it.
export function resolveAtlanticStream(server: AtlanticServer) {
  return (params: ResolveParams): Promise<ResolvedStream> => {
    const key = `${server}:${params.type}:${params.id}:${params.season}:${params.episode}`;
    return cache.get(key, async () => {
      const url = await firstInOrder(
        (await candidates(server, params)).map(async (url) => {
          if (!(await isPlayableManifest(url, { referer: SITE }))) throw new Error("Unplayable stream.");
          return url;
        }),
      );
      return { url, tracks: [], referer: SITE };
    });
  };
}
