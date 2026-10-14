import { spawn } from "node:child_process";
import { once } from "node:events";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedStreamHost } from "@/lib/hls-hosts";
import { getTargetUrl } from "@/lib/safe-fetch";
import { alignCues, audioPlaylist, mediaSegments, type Part, segmentWindow, speechActivity, type SpeechWindow, windowParts } from "@/lib/subtitle-sync";
import { cueTimes, type SubtitleSync } from "@/lib/subtitle-timing";
import { createTtlCache } from "@/lib/ttl-cache";

export const maxDuration = 120;

// Compare opening and middle audio to subtitle activity; the middle helps detect drift beyond opening music.
// Decoding minutes of audio requires cached results, concurrency caps and a dedicated rate limit.
const WINDOW_SECONDS = 150;
const MIDDLE = 0.45;
const SAMPLE_RATE = 8000;
const FFMPEG_TIMEOUT_MS = 90_000;
// Five minutes of the lowest variant is tens of MB; this stops a runaway feed.
const MAX_FEED_BYTES = 300 * 1024 * 1024;
const MAX_RUNS = 2;
type SyncResult = SubtitleSync & { confidence: number };
const cache = createTtlCache<SyncResult>(24 * 60 * 60 * 1000, 200);
let running = 0;

class SyncError extends Error {
  constructor(readonly status: number, message: string, readonly code = "failed") {
    super(message);
  }
}

// Use /api/hls to retain the allowlist, private-network checks and provider headers.
// Forward the viewer's User-Agent to match playback on unpinned CDNs.
function internalOrigin() {
  return process.env.INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

function proxied(url: string, format?: string | null) {
  const query = new URLSearchParams({ url });
  if (format) query.set("format", format);
  return `${internalOrigin()}/api/hls?${query}`;
}

// One retry: CDNs drop the odd request, and a run fetches dozens.
async function fetchOk(url: string, userAgent: string | null, range?: Part["range"]): Promise<Response> {
  const headers = new Headers();
  if (range) headers.set("range", `bytes=${range.offset}-${range.offset + range.length - 1}`);
  if (userAgent) headers.set("user-agent", userAgent);
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { cache: "no-store", headers, signal: AbortSignal.timeout(20_000) });
      if (response.ok) return response;
      await response.body?.cancel();
    } catch {
    }
    if (attempt > 0) throw new SyncError(502, "Upstream request failed.");
  }
}

async function readText(url: string, code: string, userAgent: string | null) {
  const response = await fetchOk(url, userAgent);
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) throw new SyncError(422, "Text file is too large.", code);
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel();
  }
}

async function readPlaylist(url: string, userAgent: string | null) {
  const text = await readText(url, "unsupported", userAgent);
  if (!text.trimStart().startsWith("#EXTM3U")) throw new SyncError(422, "Unsupported stream.", "unsupported");
  return text;
}

// Pipe proxied bytes into ffmpeg; never let it open URLs, since its HLS reader bypasses our proxy.
async function decodeAudio(parts: Part[], userAgent: string | null): Promise<Int16Array> {
  const ffmpeg = spawn(
    "ffmpeg",
    ["-nostdin", "-loglevel", "error", "-protocol_whitelist", "pipe", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", String(SAMPLE_RATE), "-t", String(WINDOW_SECONDS + 30), "-f", "s16le", "pipe:1"],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  const limit = (WINDOW_SECONDS + 30) * SAMPLE_RATE * 2;
  const chunks: Buffer[] = [];
  let size = 0;
  const finished = new Promise<SyncError | null>((resolve) => {
    ffmpeg.on("error", (error: NodeJS.ErrnoException) =>
      resolve(error.code === "ENOENT"
        ? new SyncError(501, "ffmpeg is not installed.", "unavailable")
        : new SyncError(502, "Audio decoding failed.")));
    ffmpeg.on("close", (code) => resolve(code === 0 ? null : new SyncError(502, "Audio decoding failed.")));
  });
  ffmpeg.stdout.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > limit) ffmpeg.kill("SIGKILL");
    else chunks.push(chunk);
  });
  // ffmpeg may exit early, on bad input or the output cap; writes then fail.
  ffmpeg.stdin.on("error", () => undefined);
  const timer = setTimeout(() => ffmpeg.kill("SIGKILL"), FFMPEG_TIMEOUT_MS);
  try {
    let fed = 0;
    for (const part of parts) {
      if (ffmpeg.exitCode !== null || ffmpeg.stdin.destroyed) break;
      const response = await fetchOk(part.url, userAgent, part.range);
      if (fed + Number(response.headers.get("content-length") ?? 0) > MAX_FEED_BYTES) {
        await response.body?.cancel();
        break;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      fed += bytes.length;
      if (fed > MAX_FEED_BYTES) break;
      if (!ffmpeg.stdin.write(bytes)) {
        await Promise.race([once(ffmpeg.stdin, "drain").catch(() => undefined), finished]);
      }
    }
    ffmpeg.stdin.end();
    const error = await finished;
    if (error) throw error;
  } finally {
    clearTimeout(timer);
    if (ffmpeg.exitCode === null) ffmpeg.kill("SIGKILL");
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < SAMPLE_RATE * 2 * 20) throw new SyncError(502, "Not enough audio.");
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
}

async function sync(stream: string, file: string, format: string | null, userAgent: string | null): Promise<SyncResult> {
  if (running >= MAX_RUNS) throw new SyncError(503, "Busy.", "busy");
  running++;
  try {
    const cues = cueTimes(await readText(proxied(file, format), "invalid-subtitles", userAgent));
    if (cues.length < 10) throw new SyncError(422, "Too few subtitle lines.", "invalid-subtitles");
    const master = proxied(stream);
    const playlistUrl = audioPlaylist(await readPlaylist(master, userAgent), master);
    const { segments, total, encrypted } = mediaSegments(await readPlaylist(playlistUrl, userAgent), playlistUrl);
    if (encrypted) throw new SyncError(422, "Encrypted stream.", "unsupported");
    const starts = total > 2 * WINDOW_SECONDS ? [0, Math.max(WINDOW_SECONDS, total * MIDDLE)] : [0];
    const windows: SpeechWindow[] = [];
    for (const from of starts) {
      const window = segmentWindow(segments, from, WINDOW_SECONDS);
      if (!window.length) continue;
      const pcm = await decodeAudio(windowParts(window), userAgent);
      windows.push({ start: window[0].start, speech: speechActivity(pcm, SAMPLE_RATE) });
    }
    if (!windows.length) throw new SyncError(502, "Empty playlist.");
    const result = alignCues(windows, cues);
    if (!result) throw new SyncError(422, "Could not sync.", "unmatched");
    return { offset: result.offset, scale: result.scale, confidence: Math.round(result.confidence * 100) / 100 };
  } finally {
    running--;
  }
}

// Require both stream and subtitle URLs to be registered with the proxy before syncing.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const stream = getTargetUrl(query.get("stream"));
  const file = getTargetUrl(query.get("file"));
  const format = query.get("format");
  if (!stream || !file || (format !== null && format !== "srt")) {
    return NextResponse.json({ error: "Invalid params." }, { status: 400 });
  }
  if (!isAllowedStreamHost(stream) || !isAllowedStreamHost(file)) {
    return NextResponse.json({ error: "Target host is not allowed." }, { status: 403 });
  }

  // Query parameters can select a different cut or audio rendition.
  const key = JSON.stringify([stream.href, file.href, format]);
  try {
    const result = await cache.get(key, () => sync(stream.href, file.href, format, request.headers.get("user-agent")));
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof SyncError ? error.status : 502;
    return NextResponse.json({
      error: error instanceof SyncError ? error.message : "Sync failed.",
      code: error instanceof SyncError ? error.code : "failed",
    }, { status, headers: { "cache-control": "no-store" } });
  }
}
