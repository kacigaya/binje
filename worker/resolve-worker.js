// Cloudflare Worker: stream resolver (current provider: vidcore.net).
// Only job: hit the provider + enc-dec.app to get the m3u8 url. The Worker's
// Cloudflare egress gets past provider-side Cloudflare blocks (Netlify/AWS IPs
// are often blocked). Segment proxying stays on Netlify /api/hls; stream
// CDNs tend to block the Worker's IP but allow Netlify's server-side fetch.

const PLAYER_ORIGIN = "https://vidcore.net";
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
  "user-agent": UA,
  referer: `${PLAYER_ORIGIN}/`,
  "x-requested-with": "XMLHttpRequest",
};

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET,OPTIONS",
    vary: "origin",
  };
}

async function resolveStream(type, id, season, episode) {
  const path =
    type === "tv" ? `/tv/${id}/${season}/${episode}/` : `/movie/${id}/`;
  const page = await fetch(`${PLAYER_ORIGIN}${path}`, {
    headers: BASE_HEADERS,
  }).then((r) => r.text());

  const text = page.match(/\\"en\\":\\"(.*?)\\"/)?.[1];
  if (!text) throw new Error("no player token");

  const enc = await fetch(`${ENC_API}/enc-vidcore?text=${text}`).then((r) =>
    r.json(),
  );
  if (enc.status !== 200) throw new Error("enc-vidcore failed");
  const { servers, stream, token } = enc.result;

  const authed = { ...BASE_HEADERS, "x-csrf-token": token };
  const serversEnc = await fetch(servers, {
    method: "POST",
    headers: authed,
  }).then((r) => r.text());
  const serversDec = await fetch(`${ENC_API}/dec-vidcore`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: serversEnc }),
  }).then((r) => r.json());
  if (serversDec.status !== 200) throw new Error("dec servers failed");

  // Some servers resolve to dead CDNs or serve DASH under an .m3u8 name;
  // probe the playlist and require actual HLS before accepting.
  for (const server of serversDec.result ?? []) {
    const streamEnc = await fetch(`${stream}/${server.data}`, {
      method: "POST",
      headers: authed,
    }).then((r) => r.text());
    const dec = await fetch(`${ENC_API}/dec-vidcore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: streamEnc }),
    }).then((r) => r.json());
    if (dec.status === 200 && dec.result?.url && (await isPlayable(dec.result.url))) {
      return { url: dec.result.url, tracks: dec.result.tracks ?? [] };
    }
  }
  throw new Error("no server returned a stream");
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

function extractM3u8(embedHtml) {
  const unpacked = unpackPacked(embedHtml) ?? embedHtml;
  const m = unpacked.match(/file\s*:\s*"([^"]+\.m3u8[^"]*)"/);
  return m ? m[1] : null;
}

async function resolveVf(type, id, season, episode) {
  const listUrl =
    type === "tv"
      ? `${FREMBED_ORIGIN}/api/series?id=${id}&sa=${season}&epi=${episode}&idType=tmdb`
      : `${FREMBED_ORIGIN}/api/films?id=${id}&idType=tmdb`;
  const meta = await fetch(listUrl, { headers: FR_HEADERS }).then((r) => r.json());

  // link1..link7 are the VF servers; probe in order for a uqload one.
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
    if (!loc || !/uqload\.\w+\/embed-/.test(loc)) continue;
    const html = await fetch(loc, { headers: FR_HEADERS }).then((r) => r.text());
    const m3u8 = extractM3u8(html);
    if (m3u8 && (await isPlayable(m3u8))) return { url: m3u8, tracks: [] };
  }
  throw new Error("no uqload stream");
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
    if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id || "")) {
      return Response.json({ error: "bad params" }, { status: 400, headers: ch });
    }
    try {
      const resolve =
        url.pathname === "/resolve-vf" ? resolveVf : resolveStream;
      const result = await resolve(
        type,
        id,
        url.searchParams.get("season") || "1",
        url.searchParams.get("episode") || "1",
      );
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
