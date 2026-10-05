import { unpackPacked } from "@/app/api/resolve-vf/uqload";
import type { ResolveParams } from "@/lib/resolve-cache";
import { fetchText, firstInOrder, httpUrl, isPlayableManifest, isRecord, type ResolvedStream } from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// 2Embed's default server is a StreamHG file: the title page names the file,
// streamsrcs.2embed.cc's swish.js names the current StreamHG host, and the
// host's packed player script lists the HLS variants.
const SITE = "https://www.2embed.cc";
const STREAMSRCS = "https://streamsrcs.2embed.cc/";
const FALLBACK_PLAYER = "https://2vcdn.skin/e/";
// hls4 is served by the player host itself; the CDN variants refused this
// server during checks but are kept as fallbacks.
const LINK_ORDER = ["hls4", "hls2", "hls3"];
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);
const playerCache = createTtlCache<string>(60 * 60 * 1000, 1);

function playerBase() {
  return playerCache.get("player", async () => {
    const script = await fetchText(`${STREAMSRCS}swish.js`, { referer: STREAMSRCS });
    return httpUrl(/"(https:\/\/[^"]+\/e\/)"\s*\+\s*myUrl/.exec(script)?.[1]) ?? FALLBACK_PLAYER;
  }).catch(() => FALLBACK_PLAYER);
}

export function streamhgLinks(playerHtml: string, playerUrl: string): string[] {
  const unpacked = unpackPacked(playerHtml) ?? playerHtml;
  const match = /var links=(\{[^}]*\})/.exec(unpacked);
  if (!match) return [];
  const links: unknown = JSON.parse(match[1]);
  if (!isRecord(links)) return [];
  return LINK_ORDER.flatMap((key) => httpUrl(links[key], playerUrl) ?? []);
}

export function resolveTwoEmbedStream({ type, id, season, episode }: ResolveParams): Promise<ResolvedStream> {
  const key = type === "tv" ? `tv:${id}:${season}:${episode}` : `movie:${id}`;
  return cache.get(key, async () => {
    const page = type === "tv" ? `${SITE}/embedtv/${id}&s=${season}&e=${episode}` : `${SITE}/embed/${id}`;
    const file = /streamsrcs\.2embed\.cc\/swish\?id=([A-Za-z0-9]+)/.exec(await fetchText(page))?.[1];
    if (!file) throw new Error("2Embed has no StreamHG file.");
    const player = `${await playerBase()}${file}`;
    const links = streamhgLinks(await fetchText(player, { referer: STREAMSRCS }), player);
    const url = await firstInOrder(
      links.map(async (link) => {
        if (!(await isPlayableManifest(link, { referer: player }))) throw new Error("Unplayable stream.");
        return link;
      }),
    );
    return { url, tracks: [], referer: player };
  });
}
