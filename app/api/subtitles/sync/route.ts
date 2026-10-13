import { spawn } from "node:child_process";
import { once } from "node:events";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedStreamHost } from "@/lib/hls-hosts";
import { getTargetUrl } from "@/lib/safe-fetch";
import { alignCues, audioPlaylist, mediaSegments, type Part, segmentWindow, speechActivity, type SpeechWindow, windowParts } from "@/lib/subtitle-sync";
import { cueTimes, type SubtitleSync } from "@/lib/subtitle-timing";
import { createTtlCache } from "@/lib/ttl-cache";

export const maxDuration = 120;

// Lines a subtitle file up with the stream's own audio: two windows of sound,
// the opening and the middle, are decoded by ffmpeg and matched against the
// file's lines. Openings are often music; the middle carries dialogue and
// shows a frame-rate drift as a different offset. Each run pulls minutes of
// the stream, so results are cached, runs are capped, and
// /api/subtitles/sync has its own small rate-limit bucket.
const WINDOW_SECONDS = 150;
const MIDDLE = 0.45;
const SAMPLE_RATE = 8000;
const FFMPEG_TIMEOUT_MS = 90_000;
// Five minutes of the lowest variant is tens of MB; this stops a runaway feed.
const MAX_FEED_BYTES = 300 * 1024 * 1024;
const MAX_RUNS = 2;
type SyncResult = SubtitleSync & { confidence: number };
const cache = createTtlCache<SyncResult | null>(24 * 60 * 60 * 1000, 200);
let running = 0;

class SyncError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// Playlists and segments are read through this server's /api/hls, so the host
// allowlist, private-network checks and provider headers all still apply.
function internalOrigin() {
  return process.env.INTERNAL_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

function proxied(url: string, format?: string | null) {
  const query = new URLSearchParams({ url });
  if (format) query.set("format", format);
  return `${internalOrigin()}/api/hls?${query}`;
}

// One retry: CDNs drop the odd request, and a run fetches dozens.
async function fetchOk(url: string, range?: Part["range"]): Promise<Response> {
  const headers = range ? { range: `bytes=${range.offset}-${range.offset + range.length - 1}` } : undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { cache: "no-store", headers, signal: AbortSignal.timeout(20_000) });
      if (response.ok) return response;
      await response.body?.cancel();
    } catch {
      // Retried below.
    }
    if (attempt > 0) throw new SyncError(502, "Upstream request failed.");
  }
}

async function readText(url: string) {
  return (await fetchOk(url)).text();
}

// ffmpeg only decodes: this server fetches the playlist and segments through
// its own proxy and pipes the bytes in, so ffmpeg itself opens no URLs. (Its
// HLS reader resolved proxied segment URLs back to the upstream host.)
async function decodeAudio(parts: Part[]): Promise<Int16Array> {
  const ffmpeg = spawn(
    "ffmpeg",
    ["-nostdin", "-loglevel", "error", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", String(SAMPLE_RATE), "-f", "s16le", "pipe:1"],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  const limit = (WINDOW_SECONDS + 30) * SAMPLE_RATE * 2;
  const chunks: Buffer[] = [];
  let size = 0;
  const finished = new Promise<void>((resolve, reject) => {
    ffmpeg.on("error", (error: NodeJS.ErrnoException) =>
      reject(error.code === "ENOENT" ? new SyncError(501, "ffmpeg is not installed.") : error));
    ffmpeg.on("close", () => resolve());
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
      const response = await fetchOk(part.url, part.range);
      if (fed + Number(response.headers.get("content-length") ?? 0) > MAX_FEED_BYTES) {
        await response.body?.cancel();
        break;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      fed += bytes.length;
      if (fed > MAX_FEED_BYTES) break;
      if (!ffmpeg.stdin.write(bytes)) await once(ffmpeg.stdin, "drain").catch(() => undefined);
    }
    ffmpeg.stdin.end();
    await finished;
  } finally {
    clearTimeout(timer);
    if (ffmpeg.exitCode === null) ffmpeg.kill("SIGKILL");
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < SAMPLE_RATE * 2 * 20) throw new SyncError(502, "Not enough audio.");
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
}

async function sync(stream: string, file: string, format: string | null): Promise<SyncResult | null> {
  if (running >= MAX_RUNS) throw new SyncError(503, "Busy.");
  running++;
  try {
    const cues = cueTimes(await readText(proxied(file, format)));
    if (cues.length < 10) throw new SyncError(422, "Too few subtitle lines.");
    const master = proxied(stream);
    const playlistUrl = audioPlaylist(await readText(master), master);
    const { segments, total, encrypted } = mediaSegments(await readText(playlistUrl), playlistUrl);
    if (encrypted) throw new SyncError(422, "Encrypted stream.");
    const starts = total > 2 * WINDOW_SECONDS ? [0, Math.max(WINDOW_SECONDS, total * MIDDLE)] : [0];
    const windows: SpeechWindow[] = [];
    for (const from of starts) {
      const window = segmentWindow(segments, from, WINDOW_SECONDS);
      if (!window.length) continue;
      const pcm = await decodeAudio(windowParts(window));
      windows.push({ start: window[0].start, speech: speechActivity(pcm, SAMPLE_RATE) });
    }
    if (!windows.length) throw new SyncError(502, "Empty playlist.");
    const result = alignCues(windows, cues);
    return result && { offset: result.offset, scale: result.scale, confidence: Math.round(result.confidence * 100) / 100 };
  } finally {
    running--;
  }
}

// Takes the stream URL the player resolved and a subtitle file it lists; both
// must already be registered with the proxy, so only real playback is synced.
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

  // Signed stream URLs change per resolve; the path names the video.
  const key = `${stream.host}${stream.pathname}\n${file.href}`;
  try {
    const result = await cache.get(key, () => sync(stream.href, file.href, format));
    if (!result) return NextResponse.json({ error: "Could not sync." }, { status: 422 });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof SyncError ? error.status : 502;
    return NextResponse.json({ error: error instanceof SyncError ? error.message : "Sync failed." }, { status });
  }
}
