import type { ResolveParams } from "@/lib/resolve-cache";
import { fetchPublic } from "@/lib/safe-fetch";
import {
  fetchJson,
  fetchText,
  firstInOrder,
  httpUrl,
  isPlayableManifest,
  isRecord,
  type ResolvedStream,
} from "@/lib/stream-check";
import { createTtlCache } from "@/lib/ttl-cache";

// player.videasy.ws (https://videasy.ws/docs.html) wraps a vidsrc.sh player in
// two iframe pages. Each page mints a short-lived token for the next: the
// wrapper's vs_src.php gives the player host URL, whose page carries a
// single-use api_token for data.vidsrc.sh. The player's Turnstile gate runs
// in that page only; the stream API does not check it.
const EMBED = "https://player.videasy.ws";
const MAX_WASM_BYTES = 1024 * 1024;
const NONCE_BYTES = 12;
const cache = createTtlCache<ResolvedStream>(10 * 60 * 1000);
// generate.php answers 429 when asked often; its tokens last about four hours.
const hostTokens = createTtlCache<string>(60 * 60 * 1000, 50);
// The decryptor rotates every few minutes and is shared by every title.
const decryptors = createTtlCache<WebAssembly.Module>(10 * 60 * 1000, 4);

// Pages embed their config as `window.NAME = {...};` on one line, ending
// the line or its inline <script>.
export function pageConfig(html: string, name: "CFG" | "CONFIG"): Record<string, unknown> | undefined {
  const json = new RegExp(`window\\.${name}\\s*=\\s*(\\{.*?\\})\\s*;\\s*(?:</script>|$)`, "m").exec(html)?.[1];
  if (!json) return;
  try {
    const value: unknown = JSON.parse(json);
    return isRecord(value) ? value : undefined;
  } catch {
    return;
  }
}

function text(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

// stream_urls is either a plain list or base64 nonce||ciphertext that the
// player's WebAssembly module decrypts in place.
export function streamUrlsPayload(body: unknown): { urls: string[] } | { encrypted: string; wasmUrl: string; window: string } {
  if (!isRecord(body) || String(body.status_code ?? body.status ?? "200") !== "200" || !isRecord(body.data)) {
    throw new Error("Videasy.ws has no stream.");
  }
  const streams = body.data.stream_urls;
  if (Array.isArray(streams)) return { urls: streams.flatMap((url) => httpUrl(url) ?? []) };
  const vs = isRecord(body.vs) ? body.vs : {};
  const wasmUrl = httpUrl(vs.wasm_url);
  if (typeof streams !== "string" || !wasmUrl) throw new Error("Videasy.ws has no stream.");
  return { encrypted: streams, wasmUrl, window: String(vs.w ?? wasmUrl) };
}

function decryptor(wasmUrl: string, window: string) {
  return decryptors.get(window, async () => {
    const response = await fetchPublic(wasmUrl, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok || Number(response.headers.get("content-length") ?? 0) > MAX_WASM_BYTES) {
      await response.body?.cancel();
      throw new Error("Videasy.ws decryptor unavailable.");
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_WASM_BYTES) throw new Error("Videasy.ws decryptor unavailable.");
    const decryptModule = await WebAssembly.compile(bytes);
    // No imports means the module can only compute: no host access at all.
    if (WebAssembly.Module.imports(decryptModule).length > 0) throw new Error("Unexpected Videasy.ws decryptor.");
    return decryptModule;
  });
}

export async function decryptStreamUrls(decryptModule: WebAssembly.Module, encrypted: string): Promise<string[]> {
  const { exports } = await WebAssembly.instantiate(decryptModule, {});
  const { alloc, decrypt, memory } = exports;
  if (typeof alloc !== "function" || typeof decrypt !== "function" || !(memory instanceof WebAssembly.Memory)) {
    throw new Error("Unexpected Videasy.ws decryptor.");
  }
  const input = Buffer.from(encrypted, "base64");
  const pointer = Number(alloc(input.length));
  new Uint8Array(memory.buffer, pointer, input.length).set(input);
  const length = Number(decrypt(pointer, input.length));
  if (!Number.isInteger(length) || length < 0 || length > input.length - NONCE_BYTES) {
    throw new Error("Invalid Videasy.ws stream list.");
  }
  const plain = new TextDecoder().decode(new Uint8Array(memory.buffer, pointer + NONCE_BYTES, length));
  return plain.split("\n").flatMap((url) => httpUrl(url.trim()) ?? []);
}

// Answered as plain text or JSON; the token is a JWT bound to this server's IP.
export function parseHostToken(body: string): string | undefined {
  let token = body.trim();
  if (token.startsWith("{") || token.startsWith('"')) {
    try {
      const value: unknown = JSON.parse(token);
      token = typeof value === "string" ? value : isRecord(value) ? (text(value.token) ?? text(value.data) ?? "") : "";
    } catch {
      return;
    }
  }
  return /^[\w.-]+$/.test(token) ? token : undefined;
}

function hostToken(origin: string) {
  return hostTokens.get(origin, async () => {
    const token = parseHostToken(await fetchText(`${origin}/generate.php`));
    if (!token) throw new Error("No Videasy.ws host token.");
    return token;
  });
}

export function withHostToken(url: string, token: string) {
  if (url.includes("__TOKEN__")) return url.split("__TOKEN__").join(token);
  const stamped = new URL(url);
  stamped.searchParams.set("token", token);
  return stamped.href;
}

async function streamUrls({ type, id, season, episode }: ResolveParams) {
  const query = new URLSearchParams({ type, id });
  if (type === "tv") {
    query.set("season", season);
    query.set("episode", episode);
  }
  const wrapper = await fetchJson(`${EMBED}/vs_src.php?${query}`, { referer: `${EMBED}/` });
  const landing = httpUrl(isRecord(wrapper) ? wrapper.src : undefined);
  if (!landing) throw new Error("Videasy.ws has no player.");
  const host = `${new URL(landing).origin}/`;

  const landingConfig = pageConfig(await fetchText(landing, { referer: `${EMBED}/` }), "CFG");
  const playerPage = httpUrl(landingConfig?.playerUrl, landing);
  if (!playerPage) throw new Error("Videasy.ws has no player.");
  const config = pageConfig(await fetchText(playerPage, { referer: host }), "CONFIG");
  const apiToken = text(config?.apiToken);
  const base = httpUrl(config?.api) ?? httpUrl(config?.streamBase);
  if (!apiToken || !base) throw new Error("Videasy.ws has no stream.");

  const api = new URL(base);
  if (!config?.api) {
    api.searchParams.set("season", season);
    api.searchParams.set("episode", episode);
    api.searchParams.set("stream_urls", "");
  }
  api.searchParams.set("api_token", apiToken);
  const payload = streamUrlsPayload(
    await fetchJson(api.href, { referer: host, headers: { origin: host.slice(0, -1) } }),
  );
  const urls =
    "urls" in payload
      ? payload.urls
      : await decryptStreamUrls(await decryptor(payload.wasmUrl, payload.window), payload.encrypted);
  // The stream CDNs refuse any Origin but the player host's.
  return { urls, referer: host };
}

export function resolveVideasyWsStream(params: ResolveParams): Promise<ResolvedStream> {
  const key = params.type === "tv" ? `tv:${params.id}:${params.season}:${params.episode}` : `movie:${params.id}`;
  return cache.get(key, async () => {
    const { urls, referer } = await streamUrls(params);
    const url = await firstInOrder(
      urls.map(async (raw) => {
        const url = withHostToken(raw, await hostToken(new URL(raw).origin));
        if (!(await isPlayableManifest(url, { referer }))) throw new Error("Unplayable stream.");
        return url;
      }),
    );
    return { url, tracks: [], referer };
  });
}
