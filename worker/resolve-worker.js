// Cloudflare Worker: stream resolver (current provider: vidcore.net).
// Only job: hit the provider + enc-dec.app to get the m3u8 url. The Worker's
// Cloudflare egress gets past provider-side Cloudflare blocks (Netlify/AWS IPs
// are often blocked). Segment proxying stays on Netlify /api/hls; stream
// CDNs tend to block the Worker's IP but allow Netlify's server-side fetch.

const PLAYER_ORIGIN = "https://vidcore.net";
const ENC_API = "https://enc-dec.app/api";
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
    if (url.pathname !== "/resolve") {
      return new Response("not found", { status: 404, headers: ch });
    }

    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id");
    if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id || "")) {
      return Response.json({ error: "bad params" }, { status: 400, headers: ch });
    }
    try {
      const result = await resolveStream(
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
