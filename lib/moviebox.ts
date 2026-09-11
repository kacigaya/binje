import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { createTtlCache } from "@/lib/ttl-cache";
import type { ResolverResult } from "@/lib/videasy";

// MovieBox is the Android app's private BFF. The request signing, client
// identity and playback flow below mirror the open-source MovieBox-Tui client
// (src/providers/moviebox/{crypto,client,adapt}.rs). Live checks on
// 2026-09-11 showed the signature and x-client-info are required; the
// spoofed x-forwarded-for the TUI sends is not, so it is left out.
const HOSTS = [
  "https://api6.aoneroom.com",
  "https://api5.aoneroom.com",
  "https://api4.aoneroom.com",
  "https://api4sg.aoneroom.com",
  "https://api3.aoneroom.com",
  "https://api6sg.aoneroom.com",
  "https://api.inmoviebox.com",
];
const BFF = "/wefeed-mobile-bff";
// App secret shipped inside the APK and published by MovieBox-Tui. A rotation
// upstream breaks this source until the constant is updated.
const SECRET = Buffer.from("76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O", "base64");
const RETRY_STATUS = new Set([403, 406, 407, 429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 8_000;
const RESOLVE_TTL_MS = 10 * 60 * 1000;
const SUBJECT_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_FALLBACK_TTL_MS = 6 * 60 * 60 * 1000;

const VERSION_CODE = 50020119;
const USER_AGENT = `com.community.oneroom/${VERSION_CODE} (Linux; U; Android 12; en_US; 2201117TY; Build/S1B.220414.015; Cronet/135.0.7012.3)`;
// One device identity per process: the gateway rejects logins without a
// device id and ties the visitor token to it.
const CLIENT_INFO = JSON.stringify({
  package_name: "com.community.oneroom",
  version_name: "4.0.01.0813.03",
  version_code: VERSION_CODE,
  os: "android",
  os_version: "12",
  install_ch: "ps",
  device_id: randomBytes(16).toString("hex"),
  install_store: "ps",
  gaid: randomUUID(),
  brand: "Redmi",
  model: "2201117TY",
  system_language: "en",
  net: "NETWORK_WIFI",
  region: "US",
  timezone: "Asia/Kolkata",
  sp_code: "40401",
  "X-Play-Mode": "2",
});

type Json = Record<string, unknown>;
type Result = ResolverResult & { cookie: string; cookieScope: string };
export type Subject = { subjectId: string; title: string; subjectType: number; releaseDate?: string };

class MovieboxError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

const resolveCache = createTtlCache<Result>(RESOLVE_TTL_MS);
const subjectCache = createTtlCache<string>(SUBJECT_TTL_MS);

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

function record(value: unknown): Json | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
}

function httpsUrl(value: unknown): URL | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url;
  } catch { /* Invalid provider URLs are discarded. */ }
}

// The gateway signs METHOD, accept, content-type, body length, timestamp, body
// md5 and the path with its query sorted by key, joined by newlines.
export function canonicalString(method: string, url: string, body: string | undefined, timestamp: number) {
  const parsed = new URL(url);
  const query = [...parsed.searchParams]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return [
    method.toUpperCase(),
    "application/json",
    "application/json",
    body === undefined ? "" : String(Buffer.byteLength(body)),
    timestamp,
    body === undefined ? "" : md5(body),
    query ? `${parsed.pathname}?${query}` : parsed.pathname,
  ].join("\n");
}

export function signedHeaders(
  method: string,
  url: string,
  body?: string,
  token?: string,
  timestamp = Date.now(),
): Record<string, string> {
  const signature = createHmac("md5", SECRET).update(canonicalString(method, url, body, timestamp)).digest("base64");
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    "user-agent": USER_AGENT,
    "x-client-token": `${timestamp},${md5(String(timestamp).split("").reverse().join(""))}`,
    "x-tr-signature": `${timestamp}|2|${signature}`,
    "x-client-info": CLIENT_INFO,
    "x-client-status": "0",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function request(method: "GET" | "POST", path: string, body?: string, token?: string): Promise<unknown> {
  let lastError: unknown = new MovieboxError("MovieBox unavailable.");
  for (const host of HOSTS) {
    const url = `${host}${path}`;
    try {
      const response = await fetch(url, {
        method,
        body,
        headers: signedHeaders(method, url, body, token),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (RETRY_STATUS.has(response.status)) {
        await response.body?.cancel();
        lastError = new MovieboxError(`MovieBox returned ${response.status}.`, response.status);
        continue;
      }
      if (!response.ok) throw new MovieboxError(`MovieBox returned ${response.status}.`, response.status);
      const json = record(await response.json());
      return json?.data ?? json;
    } catch (error) {
      if (error instanceof MovieboxError && error.status !== undefined && !RETRY_STATUS.has(error.status)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

function jwtExpiry(token: string): number | undefined {
  const payload = token.split(".")[1];
  if (!payload) return;
  try {
    const claims = record(JSON.parse(Buffer.from(payload, "base64url").toString()));
    const exp = Number(claims?.exp);
    if (Number.isFinite(exp) && exp > 0) return exp * 1000;
  } catch { /* Not a JWT: fall back to a fixed lifetime. */ }
}

let session: { token: string; expiresAt: number } | undefined;
let pendingLogin: Promise<string> | undefined;

async function login(): Promise<string> {
  const data = record(await request("POST", `${BFF}/user-api/visitor-login`, "{}"));
  const token = asString(data?.token);
  if (!token) throw new MovieboxError("MovieBox login failed.");
  const expiresAt = jwtExpiry(token) ?? Date.now() + SESSION_FALLBACK_TTL_MS;
  session = { token, expiresAt: expiresAt - 60_000 };
  return token;
}

function sessionToken(): Promise<string> {
  if (session && Date.now() < session.expiresAt) return Promise.resolve(session.token);
  pendingLogin ??= login().finally(() => { pendingLogin = undefined; });
  return pendingLogin;
}

// Test hook: the visitor session is process-wide.
export function clearMovieboxSession() {
  session = undefined;
  pendingLogin = undefined;
}

// The gateway answers an expired token with 401/403, so one retry runs on a
// fresh visitor session before the failure surfaces.
async function authedRequest(method: "GET" | "POST", path: string, body?: string): Promise<unknown> {
  try {
    return await request(method, path, body, await sessionToken());
  } catch (error) {
    const status = error instanceof MovieboxError ? error.status : undefined;
    if (status !== 401 && status !== 403) throw error;
    session = undefined;
    return request(method, path, body, await sessionToken());
  }
}

// Dubbed uploads carry a bracketed tag ("Inception [Hindi]"); the tag is
// removed for matching and counts against the candidate.
function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*[[(][^\])]*[\])]\s*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function pickSubject(
  subjects: Subject[],
  target: { type: "movie" | "tv"; title: string; year: string },
): Subject | undefined {
  const wantedType = target.type === "tv" ? 2 : 1;
  const wantedTitle = normalizeTitle(target.title);
  const wantedYear = Number(target.year);
  const scored = subjects.flatMap((subject, index) => {
    if (subject.subjectType !== wantedType || normalizeTitle(subject.title) !== wantedTitle) return [];
    const year = Number(subject.releaseDate?.slice(0, 4));
    const score =
      (/[[(][^\])]*[\])]\s*$/.test(subject.title.trim()) ? 0 : 2) +
      (Number.isFinite(year) && Math.abs(year - wantedYear) <= 1 ? 1 : 0);
    return [{ subject, score, index }];
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0]?.subject;
}

function parseSubjects(payload: unknown): Subject[] {
  const data = record(payload);
  const results = Array.isArray(data?.results) ? record(data.results[0]) : undefined;
  const list = Array.isArray(results?.subjects) ? results.subjects : Array.isArray(data?.list) ? data.list : [];
  return list.flatMap((item: unknown) => {
    const subject = record(item);
    const subjectId = asString(subject?.subjectId ?? subject?.id);
    const title = asString(subject?.title ?? subject?.name);
    if (!subjectId || !title) return [];
    const subjectType = Number(subject?.subjectType ?? subject?.stype ?? 1);
    return [{ subjectId, title, subjectType, releaseDate: asString(subject?.releaseDate ?? subject?.year) }];
  });
}

async function findSubject(params: { type: "movie" | "tv"; id: string; title: string; year: string }) {
  return subjectCache.get(`${params.type}:${params.id}`, async () => {
    const payload = await authedRequest(
      "POST",
      `${BFF}/subject-api/search/v2`,
      JSON.stringify({ keyword: params.title, page: 1, perPage: 15, subjectType: 0 }),
    );
    const subject = pickSubject(parseSubjects(payload), params);
    if (!subject) throw new MovieboxError("Not on MovieBox.");
    return subject.subjectId;
  });
}

// Playback is a CloudFront DASH manifest. The stream's `url` is a shared
// placeholder mp4; the real location is the resource path inside the signed
// CloudFront policy, and the cookie pairs must accompany every segment request.
export function dashManifestFromSignCookie(signCookie: unknown): { url: string; cookie: string; scope: string } | undefined {
  if (typeof signCookie !== "string") return;
  const pairs = signCookie.split(";").map((pair) => pair.trim()).filter((pair) => pair.startsWith("CloudFront-"));
  const policy = pairs.find((pair) => pair.startsWith("CloudFront-Policy="))?.slice("CloudFront-Policy=".length);
  if (!policy || pairs.length < 3) return;
  try {
    const decoded = Buffer.from(policy.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"), "base64").toString();
    const statement = record(JSON.parse(decoded))?.Statement;
    const resource = Array.isArray(statement) ? record(statement[0])?.Resource : undefined;
    const scopeUrl = httpsUrl(typeof resource === "string" ? resource.replace(/\*$/, "") : undefined);
    if (!scopeUrl || scopeUrl.search || scopeUrl.hash) return;
    const scope = scopeUrl.href.endsWith("/") ? scopeUrl.href : `${scopeUrl.href}/`;
    return { url: `${scope}index.mpd`, cookie: pairs.join("; "), scope };
  } catch {
    return;
  }
}

async function captionTracks(subjectId: string, resourceId: string) {
  const payload = record(await authedRequest(
    "GET",
    `${BFF}/subject-api/get-ext-captions?subjectId=${subjectId}&resourceId=${resourceId}`,
  ));
  const captions = Array.isArray(payload?.extCaptions) ? payload.extCaptions : [];
  return captions.flatMap((item: unknown) => {
    const caption = record(item);
    const url = httpsUrl(caption?.url);
    const size = Number(caption?.size ?? 0);
    // <track> only understands WebVTT, and tiny files are empty placeholders.
    if (!url || !url.pathname.endsWith(".vtt") || (size > 0 && size <= 50)) return [];
    return [{ file: url.href, label: asString(caption?.lanName) || asString(caption?.lan) || undefined }];
  });
}

export function resolveMovieboxStream(params: {
  type: "movie" | "tv"; id: string; title: string; year: string; season: string; episode: string;
}): Promise<Result> {
  const { type, id, title, year, season, episode } = params;
  if (!/^\d+$/.test(id) || (type !== "movie" && type !== "tv") || !title.trim() || title.length > 200 ||
      !/^\d{4}$/.test(year) ||
      (type === "tv" && (!/^[1-9]\d*$/.test(season) || !/^[1-9]\d*$/.test(episode)))) {
    return Promise.reject(new Error("Invalid media."));
  }
  const key = type === "tv" ? `tv:${id}:${season}:${episode}` : `movie:${id}`;
  return resolveCache.get(key, async () => {
    const subjectId = await findSubject({ type, id, title: title.trim(), year });
    const episodeQuery = type === "tv" ? `&se=${season}&ep=${episode}` : "";
    const playInfo = record(await authedRequest("GET", `${BFF}/subject-api/play-info/v2?subjectId=${subjectId}${episodeQuery}`));
    const streams = Array.isArray(playInfo?.streams) ? playInfo.streams : [];
    for (const item of streams) {
      const stream = record(item);
      const manifest = dashManifestFromSignCookie(stream?.signCookie);
      if (!manifest) continue;
      const resourceId = asString(stream?.id);
      const tracks = resourceId ? await captionTracks(subjectId, resourceId).catch(() => []) : [];
      return { url: manifest.url, tracks, cookie: manifest.cookie, cookieScope: manifest.scope };
    }
    throw new MovieboxError("No MovieBox stream.");
  });
}
