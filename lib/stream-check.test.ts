import { afterEach, expect, mock, test } from "bun:test";
import { fetchPublic } from "./safe-fetch";
import { isAllowedStreamHost } from "./hls-hosts";
import { fetchText, firstInOrder, httpUrl, isPlayableManifest, manifestHeight, probeManifest, resolveKey } from "./stream-check";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("waits for an earlier task before accepting a later success", async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const winner = firstInOrder([first.promise, second.promise]);
  second.resolve("second");
  await Promise.resolve();
  first.resolve("first");
  expect(await winner).toBe("first");
});

test("falls through failures in order and rejects when none succeed", async () => {
  expect(await firstInOrder([Promise.reject(new Error("a")), Promise.resolve("b"), Promise.resolve("c")])).toBe("b");
  await expect(firstInOrder([Promise.reject(new Error("a"))])).rejects.toThrow("No playable stream.");
  await expect(firstInOrder([])).rejects.toThrow("No playable stream.");
});

test("keeps only credential-free http URLs, resolved against a base", () => {
  expect(httpUrl("/_stream?id=1", "https://player.test/pl/")).toBe("https://player.test/_stream?id=1");
  expect(httpUrl("javascript:alert(1)")).toBeUndefined();
  expect(httpUrl("https://user:pass@cdn.test/x")).toBeUndefined();
  expect(httpUrl(42)).toBeUndefined();
});

test("counts only manifests that load, with the provider's headers", async () => {
  const seen: Headers[] = [];
  globalThis.fetch = mock(async (input: unknown, init?: RequestInit) => {
    seen.push(new Headers(init?.headers));
    return String(input).endsWith("/master.m3u8") && seen.length === 1
      ? new Response("\uFEFF#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv.m3u8\n")
      : new Response("<html>blocked</html>", { headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;
  // The variant answering HTML proves nothing either way, so the master counts.
  expect(await isPlayableManifest("https://203.0.113.40/master.m3u8", "https://player.test/e/1")).toBe(true);
  expect(seen[0].get("referer")).toBe("https://player.test/e/1");
  expect(seen[0].get("origin")).toBe("https://player.test");
  expect(seen[1].get("referer")).toBe("https://player.test/e/1");
  expect(await isPlayableManifest("https://203.0.113.40/master.m3u8")).toBe(false);
  expect(await isPlayableManifest("http://127.0.0.1/master.m3u8")).toBe(false);
  expect(seen).toHaveLength(3);
});

test("rejects short decoy clips and DASH, but not real or unfinished streams", async () => {
  const media = (seconds: number[], end = true) =>
    `#EXTM3U\n${seconds.map((s, i) => `#EXTINF:${s},\nseg${i}.ts`).join("\n")}\n${end ? "#EXT-X-ENDLIST\n" : ""}`;
  const bodies: Record<string, string> = {
    "/decoy/master.m3u8": "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nindex.m3u8\n",
    "/decoy/index.m3u8": media([6, 6, 6]),
    "/film/master.m3u8": "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nhttps://203.0.113.45/v/index.m3u8\n",
    "/v/index.m3u8": media(Array(30).fill(6)),
    "/live.m3u8": media([6, 6], false),
    "/long.mpd": '<MPD type="static" mediaPresentationDuration="PT2H28M8.5S"></MPD>',
  };
  // Paths outside the table are segments.
  globalThis.fetch = mock(async (input: unknown) => new Response(bodies[new URL(String(input)).pathname] ?? "ts")) as unknown as typeof fetch;
  expect(await isPlayableManifest("https://203.0.113.44/decoy/master.m3u8")).toBe(false);
  expect(await isPlayableManifest("https://203.0.113.44/film/master.m3u8")).toBe(true);
  expect(await isPlayableManifest("https://203.0.113.44/live.m3u8")).toBe(true);
  expect(await isPlayableManifest("https://203.0.113.44/long.mpd")).toBe(false);
});

test("rejects previews whose middle segment fails", async () => {
  const segments: (string | null)[] = [];
  const playlist = `#EXTM3U\n${Array.from({ length: 120 }, (_, i) => `#EXTINF:10,\nseg-${i}.ts`).join("\n")}\n#EXT-X-ENDLIST\n`;
  globalThis.fetch = mock(async (input: unknown, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith(".m3u8")) return new Response(playlist);
    segments.push(path, new Headers(init?.headers).get("range"));
    // Like the vidzy.cc preview: the first nine segments load, later ones answer 403.
    return new Response("ts", { status: Number(path.match(/seg-(\d+)/)?.[1]) < 9 ? 200 : 403 });
  }) as unknown as typeof fetch;
  expect(await isPlayableManifest("https://203.0.113.47/index.m3u8")).toBe(false);
  // Range is optional for HLS servers, so the probe must not depend on it.
  expect(segments).toEqual(["/seg-60.ts", null]);
});

test("reads the tallest advertised rendition", async () => {
  expect(manifestHeight("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=3840x1600\n4k.m3u8\n")).toBe(2160);
  expect(manifestHeight("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1920x1080\na.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2,RESOLUTION=3840x2160\nb.m3u8\n")).toBe(2160);
  expect(manifestHeight("#EXTM3U\n#EXTINF:6,\nseg.ts\n")).toBe(0);
  globalThis.fetch = mock(async () => new Response("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,RESOLUTION=1280x720\nlive.m3u8\n")) as unknown as typeof fetch;
  expect(await probeManifest("https://203.0.113.46/master.m3u8")).toEqual({ height: 720 });
});

test("stops probing when the resolver's shared deadline expires", async () => {
  const controller = new AbortController();
  let requests = 0;
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    requests++;
    expect(init?.signal?.aborted).toBe(false);
    controller.abort();
    expect(init?.signal?.aborted).toBe(true);
    return new Response("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n4k.m3u8\n");
  }) as unknown as typeof fetch;
  expect(await probeManifest("https://203.0.113.151/master.m3u8", undefined, controller.signal)).toBeUndefined();
  expect(requests).toBe(1);
});

test("provider requests refuse private targets and leave the proxy allowlist alone", async () => {
  const calls: string[] = [];
  globalThis.fetch = mock(async (input: unknown) => {
    calls.push(String(input));
    return String(input).includes("203.0.113.41")
      ? new Response(null, { status: 302, headers: { location: "https://203.0.113.42/page" } })
      : String(input).includes("203.0.113.42")
        ? new Response("<html>ok</html>")
        : new Response(null, { status: 302, headers: { location: "http://10.0.0.1/admin" } });
  }) as unknown as typeof fetch;
  await expect(fetchText("http://169.254.169.254/latest/meta-data")).rejects.toThrow();
  expect(await fetchText("https://203.0.113.41/start")).toBe("<html>ok</html>");
  expect(isAllowedStreamHost(new URL("https://203.0.113.42/x"))).toBe(false);
  await expect(fetchText("https://203.0.113.43/start")).rejects.toThrow("Blocked redirect target.");
  expect(calls.some((url) => url.includes("169.254") || url.includes("10.0.0.1"))).toBe(false);
});

test("resolver cache keys keep audio and episodes separate", () => {
  const params = { type: "tv", id: "1", title: "X", year: "2020", imdbId: "", season: "1", episode: "2" } as const;
  expect(resolveKey(params)).toBe("tv:1:1:2");
  expect(resolveKey({ ...params, audio: "vf" })).toBe("tv:1:1:2:vf");
  expect(resolveKey({ ...params, audio: "vostfr" })).toBe("tv:1:1:2:vostfr");
});

test("manual provider requests keep redirects unread and still block private targets", async () => {
  const fetch = mock(async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } }));
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
  const response = await fetchPublic("https://203.0.113.80/api/stream", { redirect: "manual" });
  expect(response.status).toBe(302);
  expect(fetch).toHaveBeenCalledTimes(1);
  await expect(fetchPublic("http://127.0.0.1/api/stream", { redirect: "manual" })).rejects.toThrow("Blocked target.");
  for (const target of ["http://[::ffff:127.0.0.1]/", "http://[::ffff:7f00:1]/", "http://[::ffff:a00:1]/", "http://[::127.0.0.1]/", "http://[0:0:0:0:0:ffff:7f00:1]/"]) {
    await expect(fetchPublic(target, { redirect: "manual" })).rejects.toThrow("Blocked target.");
  }
  expect(fetch).toHaveBeenCalledTimes(1);
});
