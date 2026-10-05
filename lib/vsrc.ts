import type { ResolveParams } from "@/lib/resolve-cache";
import {
  BROWSER_USER_AGENT,
  fetchJson,
  fetchText,
  firstInOrder,
  httpUrl,
  isPlayableManifest,
  isRecord,
  type ResolvedStream,
} from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// vidsrc.buzz and videm.xyz run the same player: the page embeds a signed
// token and a server list, and api.php mints a stream for one server. The
// minted URL only answers the User-Agent that minted it, so it is pinned.
const MAX_SERVERS = 4;

type Server = { ref: string; lang: string | null };
type PlayerConfig = { token: string; servers: Server[]; base: URL };

export function parsePlayerConfig(html: string, pageUrl: string): PlayerConfig {
  const match = /var Q = (\{[\s\S]*?\});\s*\n/.exec(html);
  if (!match) throw new Error("Missing player config.");
  const config: unknown = JSON.parse(match[1]);
  if (!isRecord(config) || typeof config.t !== "string" || !isRecord(config.ssr) || !Array.isArray(config.ssr.servers)) {
    throw new Error("Invalid player config.");
  }
  const servers = config.ssr.servers.flatMap((server: unknown) =>
    isRecord(server) && typeof server.ref === "string"
      ? [{ ref: server.ref, lang: typeof server.lang === "string" ? server.lang : null }]
      : [],
  );
  const base = new URL(/<base href="([^"]+)"/.exec(html)?.[1] ?? "./", pageUrl);
  return { token: config.t, servers, base };
}

export function createVsrcResolver(origin: string) {
  const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);

  async function mint(server: Server, { token, base }: PlayerConfig, page: string) {
    const api = new URL(`api.php?a=play&ref=${encodeURIComponent(server.ref)}&t=${encodeURIComponent(token)}`, base);
    const minted = await fetchJson(api.href, { referer: page });
    if (!isRecord(minted) || (minted.type !== undefined && minted.type !== "hls")) throw new Error("No HLS stream.");
    const url = httpUrl(minted.url, base);
    if (!url || !(await isPlayableManifest(url, { referer: page, userAgent: BROWSER_USER_AGENT }))) {
      throw new Error("Unplayable stream.");
    }
    return url;
  }

  return function resolve({ type, id, season, episode }: ResolveParams): Promise<ResolvedStream> {
    const path = type === "tv" ? `tv/${id}/${season}/${episode}` : `movie/${id}`;
    return cache.get(path, async () => {
      const page = `${origin}/embed/${path}`;
      const config = parsePlayerConfig(await fetchText(page), page);
      // Untagged servers carry the original audio; the rest are dubs.
      const servers = config.servers.filter((server) => !server.lang || server.lang === "English").slice(0, MAX_SERVERS);
      const url = await firstInOrder(servers.map((server) => mint(server, config, page)));
      return { url, tracks: [], referer: page, userAgent: BROWSER_USER_AGENT };
    });
  };
}

export const resolveVsrcStream = createVsrcResolver("https://vidsrc.buzz");
export const resolveVidemStream = createVsrcResolver("https://videm.xyz");
