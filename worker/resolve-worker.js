// Cloudflare Worker: Videasy Yoru HQ resolver with Neon fallback.
// Only job: hit the provider + enc-dec.app to get the m3u8 url. The Worker's
// Cloudflare egress gets past provider-side Cloudflare blocks (Netlify/AWS IPs
// are often blocked). Segment proxying stays on Netlify /api/hls; stream
// CDNs tend to block the Worker's IP but allow Netlify's server-side fetch.

const PLAYER_ORIGIN = "https://player.videasy.to";
const SOURCE_API = "https://api.wingsdatabase.com";
const ENC_API = "https://enc-dec.app/api";
// French (VF) provider. frembed serves no HLS directly — its /api/stream slots
// 302 to file hosters; only uqload gives a clean signed m3u8. Keep the unpacker
// inline (this Worker ships as a single file, separate build from the Next app).
const FREMBED_ORIGIN = "https://frembed.hair";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const ALLOWED_ORIGINS = [
  "https://binje-stream.netlify.app",
  "http://localhost:3000",
];

const BASE_HEADERS = {
  accept: "*/*",
  origin: PLAYER_ORIGIN,
  "user-agent": UA,
  referer: `${PLAYER_ORIGIN}/`,
};

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,OPTIONS",
    vary: "origin",
  };
}

function qualityHeight(value) {
  if (typeof value !== "string") return null;
  if (value.toUpperCase() === "4K") return 2160;
  const height = Number(value.match(/^(\d+)p$/i)?.[1]);
  return Number.isInteger(height) && height > 0 ? height : null;
}

function parseVideasyResult(value) {
  const adaptiveSource = value?.sources?.find(
    (item) => item.type === "hls" && typeof item.url === "string",
  );
  const sources = (value?.sources ?? [])
    .flatMap((item) => {
      const height = qualityHeight(item.quality);
      return typeof item.url === "string" && height
        ? [{ file: item.url, height }]
        : [];
    })
    .sort((a, b) => b.height - a.height);
  const defaultSource = sources.find(({ height }) => height === 1080) ?? sources[0];
  if (!adaptiveSource && !defaultSource) throw new Error("no playable HLS source");

  const labels = new Set();
  const tracks = (value?.subtitles ?? []).flatMap((item) => {
    if (typeof item.url !== "string") return [];
    const label = item.language ?? item.lang;
    if (label && labels.has(label)) return [];
    if (label) labels.add(label);
    return [{ file: item.url, label }];
  });

  return {
    url: defaultSource?.file ?? adaptiveSource.url,
    tracks,
    ...(sources.length ? { sources } : {}),
  };
}

async function resolveServer(server, parameters, id, seed) {
  const encrypted = await fetch(
    `${SOURCE_API}/${server}/sources-with-title?${parameters}`,
    { headers: BASE_HEADERS },
  ).then((response) => response.text());
  const decrypted = await fetch(`${ENC_API}/dec-videasy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: encrypted, id, seed }),
  }).then((response) => response.json());
  if (decrypted.status !== 200) throw new Error("dec-videasy failed");

  return parseVideasyResult(decrypted.result);
}

async function resolveStream(type, id, title, year, imdbId, season, episode) {
  const seedData = await fetch(`${SOURCE_API}/seed?mediaId=${id}`, {
    headers: BASE_HEADERS,
  }).then((response) => response.json());
  if (!seedData.seed) throw new Error("no Videasy seed");

  const parameters = new URLSearchParams({
    title: encodeURIComponent(title),
    mediaType: type,
    year,
    tmdbId: id,
    imdbId,
    enc: "2",
    seed: seedData.seed,
  });
  if (type === "tv") {
    parameters.set("seasonId", season);
    parameters.set("episodeId", episode);
  }

  const highQuality = await resolveServer(
    "cdn",
    parameters,
    id,
    seedData.seed,
  ).catch(() =>
    resolveServer("cdn", parameters, id, seedData.seed).catch(() => null),
  );
  if (highQuality?.sources?.some(({ height }) => height >= 1080)) {
    return highQuality;
  }

  return resolveServer("neon2", parameters, id, seedData.seed);
}

const FR_HEADERS = { "user-agent": UA, referer: `${FREMBED_ORIGIN}/` };

// Reverse the Dean Edwards p.a.c.k.e.r uqload wraps its jwplayer setup in, then
// pull the signed HLS url. Pure string work — never eval remote code.
function unpackPacked(source) {
  const m = source.match(
    /\}\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/,
  );
  if (!m) return null;
  let payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  const radix = Number(m[2]);
  let count = Number(m[3]);
  const dict = m[4].split("|");
  while (count--) {
    if (dict[count]) {
      payload = payload.replace(
        new RegExp("\\b" + count.toString(radix) + "\\b", "g"),
        dict[count],
      );
    }
  }
  return payload;
}

// Generic: unpack any packer, then grab the first in-page HLS url. Caller must
// probe it. In practice only uqload resolves; other hosters (netu IP-locked,
// playmogo JS-gated) yield nothing and fall through to a 502 + UI note.
function scrapeM3u8(embedHtml) {
  const unpacked = unpackPacked(embedHtml) ?? embedHtml;
  const m = unpacked.match(/https?:\/\/[^"'\s\\)]+\.m3u8[^"'\s\\)]*/);
  return m ? m[0] : null;
}

async function extractFromHoster(embedUrl) {
  const origin = new URL(embedUrl).origin;
  const html = await fetch(embedUrl, {
    headers: { ...FR_HEADERS, referer: `${origin}/` },
  }).then((r) => r.text());
  const m3u8 = scrapeM3u8(html);
  return m3u8 && (await isPlayable(m3u8)) ? m3u8 : null;
}

async function resolveVf(type, id, season, episode) {
  const listUrl =
    type === "tv"
      ? `${FREMBED_ORIGIN}/api/series?id=${id}&sa=${season}&epi=${episode}&idType=tmdb`
      : `${FREMBED_ORIGIN}/api/films?id=${id}&idType=tmdb`;
  const meta = await fetch(listUrl, { headers: FR_HEADERS }).then((r) => r.json());

  // link1..link7 are the VF servers; try each, first playable wins.
  const paths = [];
  for (let i = 1; i <= 7; i++) if (meta[`link${i}`]) paths.push(meta[`link${i}`]);
  if (!paths.length) throw new Error("no vf servers");

  for (const path of paths) {
    const loc = (
      await fetch(`${FREMBED_ORIGIN}${path}`, {
        headers: FR_HEADERS,
        redirect: "manual",
      })
    ).headers.get("location");
    if (!loc) continue;
    const url = await extractFromHoster(loc).catch(() => null);
    if (url) return { url, tracks: [] };
  }
  throw new Error("no vf stream");
}

// Stream CDNs block the Worker's IP, so probe through Netlify's /api/hls;
// the same proxy the player fetches through, so the probe tests the real path.
async function isPlayable(url) {
  try {
    const res = await fetch(
      `${ALLOWED_ORIGINS[0]}/api/hls?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return false;
    const head = (await res.text()).slice(0, 16);
    return head.trimStart().startsWith("#EXTM3U");
  } catch {
    return false;
  }
}

const worker = {
  async fetch(request) {
    const url = new URL(request.url);
    const ch = cors(request.headers.get("origin") || "");

    if (request.method === "OPTIONS") return new Response(null, { headers: ch });
    if (url.pathname !== "/resolve" && url.pathname !== "/resolve-vf") {
      return new Response("not found", { status: 404, headers: ch });
    }

    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id");
    const title = url.searchParams.get("title")?.trim() || "";
    const year = url.searchParams.get("year") || "";
    const imdbId = url.searchParams.get("imdbId")?.trim() || "";
    const season = url.searchParams.get("season") || "1";
    const episode = url.searchParams.get("episode") || "1";
    const isVf = url.pathname === "/resolve-vf";
    const validEpisode =
      type !== "tv" || (/^[1-9]\d*$/.test(season) && /^[1-9]\d*$/.test(episode));
    if (
      (type !== "movie" && type !== "tv") ||
      !/^\d+$/.test(id || "") ||
      (!isVf && (!title || title.length > 200 || !/^\d{4}$/.test(year))) ||
      (!isVf && imdbId !== "" && !/^tt\d+$/.test(imdbId)) ||
      !validEpisode
    ) {
      return Response.json({ error: "bad params" }, { status: 400, headers: ch });
    }
    try {
      const result = isVf
        ? await resolveVf(type, id, season, episode)
        : await resolveStream(type, id, title, year, imdbId, season, episode);
      return Response.json(result, {
        headers: { ...ch, "cache-control": "no-store" },
      });
    } catch (err) {
      return Response.json(
        { error: "resolve failed", debug: String(err) },
        { status: 502, headers: ch },
      );
    }
  },
};

export default worker;
