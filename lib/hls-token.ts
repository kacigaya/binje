// Signs the /api/hls proxy URLs. Without a signature the proxy will fetch any
// public host on demand, which makes it an open relay running on our egress.
// Resolvers mint the URLs, /api/hls verifies them, nothing else gets fetched.

const TTL_SECONDS = 6 * 60 * 60;

/**
 * No dedicated secret is required: any deploy that can resolve a stream
 * already has one of these, and they stay identical across instances.
 */
function signingSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const value =
    env.HLS_SIGNING_SECRET ||
    env.STORAGE_SECRET_ACCESS_KEY ||
    env.TMDB_API_KEY ||
    "";
  return value.trim() || null;
}

async function sign(target: string, expiresAt: number, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${target}\n${expiresAt}`),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function equalsConstantTime(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Builds the signed `/api/hls` URL a client should fetch for `target`. */
export async function proxyUrl(
  origin: string,
  target: string,
  now: number = Date.now(),
): Promise<string> {
  const url = new URL("/api/hls", origin);
  url.searchParams.set("url", target);

  const secret = signingSecret();
  if (secret) {
    const expiresAt = Math.floor(now / 1000) + TTL_SECONDS;
    url.searchParams.set("exp", String(expiresAt));
    url.searchParams.set("sig", await sign(target, expiresAt, secret));
  }
  return url.toString();
}

type StreamFile = { file: string };
type ResolverPayload = {
  url: string;
  tracks?: StreamFile[];
  sources?: StreamFile[];
};

/** Rewrites every stream URL in a resolver response into a signed proxy URL. */
export async function proxyResolverPayload<T extends ResolverPayload>(
  origin: string,
  payload: T,
): Promise<T> {
  const proxyFiles = <U extends StreamFile>(items: U[]) =>
    Promise.all(
      items.map(async (item) => ({
        ...item,
        file: await proxyUrl(origin, item.file),
      })),
    );

  return {
    ...payload,
    url: await proxyUrl(origin, payload.url),
    ...(payload.tracks ? { tracks: await proxyFiles(payload.tracks) } : {}),
    ...(payload.sources ? { sources: await proxyFiles(payload.sources) } : {}),
  };
}

export async function isSignedProxyRequest(
  target: string,
  exp: string | null,
  sig: string | null,
  now: number = Date.now(),
): Promise<boolean> {
  const secret = signingSecret();
  if (!secret || !exp || !sig) return false;

  const expiresAt = Number(exp);
  if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= now) return false;

  return equalsConstantTime(sig, await sign(target, expiresAt, secret));
}
