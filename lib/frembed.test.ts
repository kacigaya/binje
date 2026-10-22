import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { extractM3u8, preferredStreamPaths, scrapeM3u8, unpackPacked } from "./frembed";

const PACKED =
  "eval(function(p,a,c,k,e,d){while(c--)if(k[c])p=p.replace(new RegExp(String.raw`\\b`+c.toString(a)+String.raw`\\b`,\"g\"),k[c]);return p}('0(\"1\").2({3:[{4:\"5://6.7.8/9/a.b?c=d&e=43200\"}]})',15,15,'jwplayer|vplayer|setup|sources|file|https|strm1|uqload|is|hls2|master|m3u8|t|abc|e'.split('|')))";

test("unpackPacked restores the packed jwplayer setup", () => {
  const out = unpackPacked(PACKED);
  expect(out).toBe(
    'jwplayer("vplayer").setup({sources:[{file:"https://strm1.uqload.is/hls2/master.m3u8?t=abc&e=43200"}]})',
  );
});

test("extractM3u8 pulls the signed HLS url", () => {
  expect(extractM3u8(PACKED)).toBe(
    "https://strm1.uqload.is/hls2/master.m3u8?t=abc&e=43200",
  );
});

test("returns null when there is no packer / no m3u8", () => {
  expect(unpackPacked("<html>no packer here</html>")).toBeNull();
  expect(extractM3u8("<html>no packer here</html>")).toBeNull();
  expect(scrapeM3u8("<html>no stream here</html>")).toBeNull();
});

test("scrapeM3u8 grabs a plain in-page m3u8 (non-uqload hoster)", () => {
  const html = `<video><source src="https://cdn.example.net/vod/abc/master.m3u8?t=xyz"></video>`;
  expect(scrapeM3u8(html)).toBe(
    "https://cdn.example.net/vod/abc/master.m3u8?t=xyz",
  );
  expect(scrapeM3u8(PACKED)).toBe(
    "https://strm1.uqload.is/hls2/master.m3u8?t=abc&e=43200",
  );
});

test("selects requested audio, Uqload first, and skips Voe/Dood", () => {
  const meta = {
    links: [
      { lang: "vf", position: 1, host: { slug: "voe" }, url: "/api/stream?server=id:1" },
      { lang: "vf", position: 2, host: { slug: "netu" }, url: "/api/stream?server=id:2" },
      { lang: "vf", position: 3, host: { slug: "uqload" }, url: "/api/stream?server=id:3" },
      { lang: "vostfr", host: { slug: "uqload" }, url: "/api/stream?server=id:4" },
      { lang: "vf", host: { slug: "dood" }, url: "/api/stream?server=id:5" },
      { lang: "vo", host: { slug: "uqload" }, url: "/api/stream?server=id:6" },
    ],
    link1: "/api/stream?server=id:1",
    link5: "/api/stream?server=id:5",
    link7: "/api/stream?server=legacy",
    link1vostfr: "/api/stream?server=legacy-sub",
  };
  expect(preferredStreamPaths(meta)).toEqual([
    "https://frembed.bar/api/stream?server=id:3",
    "https://frembed.bar/api/stream?server=id:2",
    "https://frembed.bar/api/stream?server=legacy",
  ]);
  expect(preferredStreamPaths(meta, "vostfr")).toEqual([
    "https://frembed.bar/api/stream?server=id:4",
    "https://frembed.bar/api/stream?server=legacy-sub",
  ]);
});

test("discards invalid slots and uncovered titles", () => {
  expect(preferredStreamPaths({ error: "Series not found" })).toEqual([]);
  expect(preferredStreamPaths({ link1: "http://127.0.0.1/api/stream", link2: "/api/films", link3: "https://user:pass@frembed.bar/api/stream" })).toEqual([]);
  expect(preferredStreamPaths({ links: [null, { lang: "vf", host: null }] })).toEqual([]);
});

test("rejects malformed packer limits without evaluating code", () => {
  expect(unpackPacked("}('0',10,20,'https'.split('|'))")).toBeNull();
  expect(unpackPacked("x".repeat(256 * 1024 + 1))).toBeNull();
  expect(unpackPacked("}('0',99,1,'https'.split('|'))")).toBeNull();
  expect(unpackPacked("}('0',36,100001,'https'.split('|'))")).toBeNull();
});

import * as network from "./safe-fetch";
import * as check from "./stream-check";
import { resolveFrembedStream } from "./frembed";
import { availablePlaybackSources, resolvePlaybackSource } from "./sources";
import { isAllowedStreamHost } from "./hls-hosts";

const params: check.ResolveParams = {
  type: "movie", id: "901", title: "Fixture", year: "2026", imdbId: "", season: "1", episode: "1",
};
afterEach(() => { mock.restore(); });

test("walks slots, probes with provider Referer, registers streams and caches by audio", async () => {
  const meta = spyOn(check, "fetchJson").mockResolvedValue({ links: [
    { lang: "vf", host: { slug: "uqload" }, url: "/api/stream?server=id:91" },
    { lang: "vf", host: { slug: "netu" }, url: "/api/stream?server=id:92" },
    { lang: "vostfr", host: { slug: "netu" }, url: "/api/stream?server=id:93" },
  ] });
  const slots = spyOn(network, "fetchPublic").mockImplementation(async (url) => new Response(null, {
    status: 302, headers: { location: String(url).endsWith("91") ? "https://uqload.vc/embed-a.html" : "https://netu.frembed.bond/e/b" },
  }));
  spyOn(check, "fetchText").mockImplementation(async (url) => url.includes("uqload")
    ? PACKED : '<source src="https://203.0.113.201/video.m3u8">');
  const probe = spyOn(check, "probeManifest").mockImplementation(async (_url, referer) =>
    referer === "https://uqload.vc/" ? undefined : { height: 1080 });
  const result = await resolvePlaybackSource("frembed", params);
  expect(result).toEqual({ url: "https://203.0.113.201/video.m3u8", tracks: [], referer: "https://netu.frembed.bond/", height: 1080 });
  expect(isAllowedStreamHost(new URL(result.url))).toBe(true);
  expect(probe.mock.calls[0][1]).toBe("https://uqload.vc/");
  expect(slots.mock.calls[0][1]?.redirect).toBe("manual");
  expect(new Headers(slots.mock.calls[0][1]?.headers).get("referer")).toBe("https://frembed.bar/");
  await resolveFrembedStream({ ...params, audio: "vf" });
  expect(meta).toHaveBeenCalledTimes(1);
  await resolveFrembedStream({ ...params, audio: "vostfr" });
  expect(meta).toHaveBeenCalledTimes(2);
  expect(slots.mock.calls.at(-1)?.[0]).toContain("id:93");
});

test("VF availability omits uncovered series and never resolves VO providers", async () => {
  const meta = spyOn(check, "fetchJson").mockResolvedValue({ error: "Series not found" });
  const slots = spyOn(network, "fetchPublic");
  expect(await availablePlaybackSources({ ...params, type: "tv", id: "902", season: "2", episode: "3" }, "vf")).toEqual([]);
  expect(meta.mock.calls[0][0]).toContain("/api/series?");
  expect(meta.mock.calls[0][0]).toContain("sa=2&epi=3");
  expect(slots).not.toHaveBeenCalled();
});

test("skips unsupported legacy redirects without fetching browser-gated embeds", async () => {
  spyOn(check, "fetchJson").mockResolvedValue({ link1: "/api/stream?server=legacy" });
  spyOn(network, "fetchPublic").mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://voe.sx/e/a" } }));
  const page = spyOn(check, "fetchText");
  await expect(resolveFrembedStream({ ...params, id: "903" })).rejects.toThrow("No Frembed server");
  expect(page).not.toHaveBeenCalled();
});

test("rejects hoster origins with HTTP or nonstandard ports", async () => {
  spyOn(check, "fetchJson").mockResolvedValue({ link1: "/api/stream?server=legacy" });
  const slot = spyOn(network, "fetchPublic");
  const page = spyOn(check, "fetchText");
  for (const [index, location] of ["http://uqload.vc/embed-a.html", "https://netu.frembed.bond:8443/e/a"].entries()) {
    slot.mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    await expect(resolveFrembedStream({ ...params, id: `904${index}` })).rejects.toThrow("No Frembed server");
  }
  expect(page).not.toHaveBeenCalled();
});

test("stops walking slots when the shared resolution deadline expires", async () => {
  const controller = new AbortController();
  spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  spyOn(check, "fetchJson").mockImplementation(async (_url, init) => {
    expect(init?.signal).toBe(controller.signal);
    controller.abort(new Error("Deadline"));
    return { link1: "/api/stream?server=legacy", link2: "/api/stream?server=legacy-2" };
  });
  const slots = spyOn(network, "fetchPublic");
  await expect(resolveFrembedStream({ ...params, id: "905" })).rejects.toThrow("Deadline");
  expect(slots).not.toHaveBeenCalled();
});
