import { afterEach, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { allowStreamHost } from "@/lib/hls-hosts";
import { GET } from "./route";

const get = (query: string) => GET(new NextRequest(`http://localhost/api/subtitles/sync?${query}`));

test("rejects bad params and streams or files the proxy never registered", async () => {
  expect((await get("stream=nope&file=https://subs.test/a.vtt")).status).toBe(400);
  expect((await get("stream=https://cdn.test/m.m3u8&file=https://subs.test/a.vtt&format=ass")).status).toBe(400);
  expect((await get("stream=https://203.0.113.40/m.m3u8&file=https://203.0.113.41/a.vtt")).status).toBe(403);
});

const originalFetch = globalThis.fetch;
const originalPath = process.env.PATH;
afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.PATH = originalPath;
});

const cues: [number, number][] = [
  [3, 5], [10, 11.5], [16, 19], [23, 25], [31, 33], [37, 40],
  [45, 46], [51, 54], [62, 64], [69, 72], [79, 80], [85, 88],
  [96, 98], [103, 106], [115, 117], [123, 124], [132, 134], [140, 142],
];
const timestamp = (seconds: number) => `00:${String(Math.floor(seconds / 60)).padStart(2, "0")}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
const subtitle = `WEBVTT\n\n${cues.map(([start, end]) => `${timestamp(start)} --> ${timestamp(end)}\nLine\n`).join("\n")}`;

// WAV keeps the decoder test independent of a fixture file or an encoder.
function wav(offset: number | null) {
  const rate = 8000;
  const samples = rate * 150;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const time = i / rate;
    const speaking = offset !== null && cues.some(([start, end]) => time >= start + offset && time < end + offset);
    bytes.writeInt16LE(Math.round((speaking ? 6000 : 100) * Math.sin(2 * Math.PI * 1000 * time)), 44 + i * 2);
  }
  return bytes;
}

function syncRequest(name: string, cut = "a") {
  const stream = `https://sync.test/${name}.m3u8?cut=${cut}`;
  const file = `https://sync.test/${name}.vtt`;
  allowStreamHost(stream);
  allowStreamHost(file);
  const query = new URLSearchParams({ stream, file });
  return new NextRequest(`http://localhost/api/subtitles/sync?${query}`, { headers: { "user-agent": "Playback browser" } });
}

function proxyResponses(audio: () => BodyInit, playlist = "#EXTM3U\n#EXTINF:150,\n/api/hls?url=https%3A%2F%2Fsync.test%2Faudio.wav\n") {
  const seen: Headers[] = [];
  globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    seen.push(new Headers(init?.headers));
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const target = url.searchParams.get("url") ?? "";
    return new Response(target.endsWith(".vtt") ? subtitle : target.endsWith(".wav") ? audio() : playlist);
  }, { preconnect: originalFetch.preconnect });
  return seen;
}

test("identifies unsupported streams and subtitle files separately", async () => {
  proxyResponses(() => "", '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n#EXTINF:150,\nseg.ts\n');
  const encrypted = await GET(syncRequest("encrypted"));
  expect(encrypted.status).toBe(422);
  expect((await encrypted.json()).code).toBe("unsupported");

  proxyResponses(() => "", "not a playlist");
  const direct = await GET(syncRequest("direct"));
  expect(direct.status).toBe(422);
  expect((await direct.json()).code).toBe("unsupported");

  globalThis.fetch = Object.assign(async () => new Response("WEBVTT\n"), { preconnect: originalFetch.preconnect });
  const empty = await GET(syncRequest("empty"));
  expect(empty.status).toBe(422);
  expect((await empty.json()).code).toBe("invalid-subtitles");
});

const audioTest = Bun.which("ffmpeg") ? test : test.skip;

audioTest("decodes audio with playback headers and isolates cuts in the cache", async () => {
  let offset = 3.2;
  const seen = proxyResponses(() => wav(offset));
  const first = await GET(syncRequest("cuts", "a"));
  expect(first.status).toBe(200);
  expect((await first.json()).offset).toBeCloseTo(3.2, 1);
  expect(seen.every((headers) => headers.get("user-agent") === "Playback browser")).toBe(true);

  offset = -2.5;
  const second = await GET(syncRequest("cuts", "b"));
  expect(second.status).toBe(200);
  expect((await second.json()).offset).toBeCloseTo(-2.5, 1);
});

audioTest("a failed match is retried rather than cached for a day", async () => {
  let offset: number | null = null;
  proxyResponses(() => wav(offset));
  const failed = await GET(syncRequest("retry"));
  expect(failed.status).toBe(422);
  expect((await failed.json()).code).toBe("unmatched");
  offset = 3.2;
  const retried = await GET(syncRequest("retry"));
  expect(retried.status).toBe(200);
});

audioTest("decoder failure completes instead of waiting forever for stdin to drain", async () => {
  proxyResponses(() => "invalid audio".repeat(10000));
  const failed = await GET(syncRequest("bad-audio"));
  expect(failed.status).toBe(502);
  expect((await failed.json()).code).toBe("failed");
});

test("a missing decoder returns a service error without an unhandled rejection", async () => {
  proxyResponses(() => "audio");
  process.env.PATH = "/no-ffmpeg";
  const failed = await GET(syncRequest("missing-decoder"));
  expect(failed.status).toBe(501);
  expect((await failed.json()).code).toBe("unavailable");
});
