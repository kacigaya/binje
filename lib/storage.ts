// Minimal AWS SigV4 query presigner for S3-compatible storage (R2, S3, MinIO,
// B2). Credentials never leave the server: the resolver returns unsigned
// object URLs and /api/hls signs each fetch on the way out.

const ALGORITHM = "AWS4-HMAC-SHA256";
const SERVICE = "s3";
const DEFAULT_TTL_SECONDS = 900;

/** Media files the proxy is allowed to sign for. Everything else is refused. */
const ALLOWED_EXTENSIONS = [".m3u8", ".ts", ".m4s", ".mp4", ".vtt", ".json"];

export type StorageConfig = {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
  ttlSeconds: number;
};

export function storageConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): StorageConfig | null {
  const endpoint = env.STORAGE_ENDPOINT?.trim().replace(/\/+$/, "");
  const bucket = env.STORAGE_BUCKET?.trim();
  const accessKeyId = env.STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.STORAGE_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  const ttl = Number(env.STORAGE_URL_TTL_SECONDS);
  return {
    endpoint,
    bucket,
    region: env.STORAGE_REGION?.trim() || "auto",
    accessKeyId,
    secretAccessKey,
    prefix: env.STORAGE_PREFIX?.trim().replace(/^\/+|\/+$/g, "") ?? "",
    ttlSeconds: Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_SECONDS,
  };
}

/** RFC 3986 escaping — encodeURIComponent leaves !'()* alone, S3 does not. */
function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeKey(key: string) {
  return key.split("/").map(encodeRfc3986).join("/");
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return toHex(digest);
}

async function hmac(key: ArrayBuffer | Uint8Array, text: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(text),
  );
}

async function signingKey(config: StorageConfig, date: string) {
  let key: ArrayBuffer | Uint8Array = new TextEncoder().encode(
    `AWS4${config.secretAccessKey}`,
  );
  for (const part of [date, config.region, SERVICE, "aws4_request"]) {
    key = await hmac(key, part);
  }
  return key;
}

export function objectUrl(config: StorageConfig, key: string) {
  const path = config.prefix ? `${config.prefix}/${key}` : key;
  return `${config.endpoint}/${encodeKey(config.bucket)}/${encodeKey(path)}`;
}

/** Resolves a manifest entry: absolute URLs pass through, keys become objects. */
export function resolveFileUrl(config: StorageConfig, file: string) {
  return /^https?:\/\//i.test(file) ? file : objectUrl(config, file);
}

export async function presignGet(
  config: StorageConfig,
  url: string,
  now: Date = new Date(),
) {
  const target = new URL(url);
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${config.region}/${SERVICE}/aws4_request`;

  const query = new Map<string, string>([
    ["X-Amz-Algorithm", ALGORITHM],
    ["X-Amz-Credential", `${config.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(config.ttlSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ]);
  for (const [name, value] of target.searchParams) query.set(name, value);

  const canonicalQuery = [...query.entries()]
    .map(([name, value]) => [encodeRfc3986(name), encodeRfc3986(value)])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    target.pathname,
    canonicalQuery,
    `host:${target.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    ALGORITHM,
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = toHex(
    await hmac(await signingKey(config, date), stringToSign),
  );
  return `${target.origin}${target.pathname}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Guards /api/hls: only media objects inside the configured bucket/prefix get
 * signed, so the proxy can never be used to read arbitrary bucket keys.
 */
export function isLibraryObject(config: StorageConfig, url: URL) {
  const endpoint = new URL(config.endpoint);
  if (url.protocol !== endpoint.protocol || url.host !== endpoint.host) return false;

  let path: string;
  try {
    path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    return false;
  }
  if (!path.startsWith(`${config.bucket}/`)) return false;

  const key = path.slice(config.bucket.length + 1);
  if (!key || key.split("/").includes("..")) return false;
  if (config.prefix && !key.startsWith(`${config.prefix}/`)) return false;

  return ALLOWED_EXTENSIONS.some((extension) =>
    key.toLowerCase().endsWith(extension),
  );
}
