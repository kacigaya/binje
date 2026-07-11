import { NextRequest, NextResponse } from "next/server";

// ponytail: stream extraction depends on enc-dec.app (third-party, closed-source,
// 40 req/s). If it breaks, swap providers; no fallback hosted here.
// Provider history: videasy → vidlink → vidfast (died 2026-07) → vidcore.
const PLAYER_ORIGIN = "https://vidcore.net";
const ENC_API = "https://enc-dec.app/api";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export const runtime = "nodejs";
export const maxDuration = 20;

const BASE_HEADERS = {
  "user-agent": BROWSER_USER_AGENT,
  referer: `${PLAYER_ORIGIN}/`,
  "x-requested-with": "XMLHttpRequest",
};

type Track = { file: string; label?: string; kind?: string };

async function extract(path: string) {
  const page = await fetch(`${PLAYER_ORIGIN}${path}`, {
    headers: BASE_HEADERS,
    cache: "no-store",
  }).then((r) => r.text());

  const text = page.match(/\\"en\\":\\"(.*?)\\"/)?.[1];
  if (!text) throw new Error("No player token in page.");

  const enc = await fetch(`${ENC_API}/enc-vidcore?text=${text}`).then((r) =>
    r.json(),
  );
  if (enc.status !== 200) throw new Error("enc-vidcore failed.");
  const { servers, stream, token } = enc.result as {
    servers: string;
    stream: string;
    token: string;
  };

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
  if (serversDec.status !== 200) throw new Error("dec-vidcore (servers) failed.");

  const list = serversDec.result as { data: string }[];
  if (!list?.length) throw new Error("No servers available.");

  // Try servers in order until one yields a playable url. Some servers
  // resolve to dead CDNs or serve DASH MPDs under an .m3u8 name, so probe
  // the playlist and require actual HLS before accepting.
  for (const server of list) {
    const streamEnc = await fetch(`${stream}/${server.data}`, {
      method: "POST",
      headers: authed,
    }).then((r) => r.text());
    const streamDec = await fetch(`${ENC_API}/dec-vidcore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: streamEnc }),
    }).then((r) => r.json());
    const url = streamDec?.result?.url as string | undefined;
    if (streamDec.status === 200 && url && (await isPlayable(url))) {
      const tracks = (streamDec.result.tracks ?? []) as Track[];
      return { url, tracks };
    }
  }
  throw new Error("No server returned a stream.");
}

async function isPlayable(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_USER_AGENT, referer: `${PLAYER_ORIGIN}/` },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const head = (await res.text()).slice(0, 16);
    return head.trimStart().startsWith("#EXTM3U");
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const type = q.get("type");
  const id = q.get("id");
  if ((type !== "movie" && type !== "tv") || !/^\d+$/.test(id ?? "")) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }

  const path =
    type === "tv"
      ? `/tv/${id}/${q.get("season") ?? "1"}/${q.get("episode") ?? "1"}/`
      : `/movie/${id}/`;

  try {
    const result = await extract(path);
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve stream." },
      { status: 502 },
    );
  }
}
