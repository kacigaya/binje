import { describe, expect, test } from "bun:test";
import {
  atlanticQuery,
  atlanticSourceValues,
  atlanticStreamPayload,
  isAtlanticDecoy,
  unwrapAtlanticUrl,
} from "@/lib/atlantic";

const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

async function wrap(prefix: string, plain: string) {
  const iv = new Uint8Array(12).fill(7);
  const key = await crypto.subtle.importKey("raw", Buffer.from(KEY, "hex"), { name: "AES-GCM" }, false, ["encrypt"]);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)));
  return `${prefix}${hex(iv)}${hex(sealed)}`;
}

describe("unwrapAtlanticUrl", () => {
  test("decrypts the prefixed payload to its URL", async () => {
    expect(await unwrapAtlanticUrl(await wrap("ms_", "https://cdn.test/master.m3u8"), "ms_", KEY)).toBe(
      "https://cdn.test/master.m3u8",
    );
  });

  test("passes plain URLs through and drops non-http plaintext", async () => {
    expect(await unwrapAtlanticUrl("https://cdn.test/a.m3u8", "ms_", KEY)).toBe("https://cdn.test/a.m3u8");
    expect(await unwrapAtlanticUrl(await wrap("ms_", "javascript:alert(1)"), "ms_", KEY)).toBeUndefined();
  });

  test("rejects short, malformed or tampered payloads", async () => {
    await expect(unwrapAtlanticUrl("ms_abcd", "ms_", KEY)).rejects.toThrow();
    await expect(unwrapAtlanticUrl("ms_zz", "ms_", KEY)).rejects.toThrow();
    const sealed = await wrap("ms_", "https://cdn.test/master.m3u8");
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("00") ? "01" : "00");
    await expect(unwrapAtlanticUrl(tampered, "ms_", KEY)).rejects.toThrow();
  });
});

test("reads named sources in the server's order", () => {
  const body = { sources: { Neptune: { url: "n" }, Saturn: { url: "s" }, Other: { url: "o" } } };
  expect(atlanticSourceValues(body, ["Saturn", "Neptune"])).toEqual(["s", "n"]);
  expect(atlanticSourceValues({ error: "disabled" }, ["Moscow"])).toEqual([]);
});

test("reads the single-source payload under either name", () => {
  expect(atlanticStreamPayload({ hls: "pd_payload" })).toBe("pd_payload");
  expect(atlanticStreamPayload({ dash: "pd_old" })).toBe("pd_old");
  expect(atlanticStreamPayload({ hls: "pd_new", dash: "pd_old" })).toBe("pd_new");
  expect(atlanticStreamPayload({ error: "disabled" })).toBeUndefined();
  expect(atlanticStreamPayload(null)).toBeUndefined();
});

test("uses each server's parameter names", () => {
  const episode = { type: "tv", id: "1399", title: "x", year: "2011", imdbId: "", season: "2", episode: "3" } as const;
  expect(atlanticQuery("athena", episode).toString()).toBe("tmdb=1399&type=tv&season=2&episode=3");
  expect(atlanticQuery("wrapped", episode).toString()).toBe("tmdbId=1399&type=tv&seasonId=2&episodeId=3");
  expect(atlanticQuery("wrapped", { ...episode, type: "movie" }).toString()).toBe("tmdbId=1399&type=movie");
});

test("isAtlanticDecoy flags HD ladders that never reach real bitrates", () => {
  const variant = (bandwidth: number, resolution: string) =>
    `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},CODECS="avc1.42c033,mp4a.40.2"\nv.m3u8\n`;
  const master = (...variants: string[]) => `#EXTM3U\n${variants.join("")}`;
  expect(isAtlanticDecoy(master(variant(352459, "3840x2160"), variant(276952, "1920x1080")))).toBe(true);
  expect(isAtlanticDecoy(master(variant(276952, "1920x1080")))).toBe(true);
  // A low HD rung is fine when the ladder also carries a real top rung.
  expect(isAtlanticDecoy(master(variant(800_000, "1920x1080"), variant(5_000_000, "1920x1080")))).toBe(false);
  expect(isAtlanticDecoy(master(variant(5_200_000, "1920x1080")))).toBe(false);
  expect(isAtlanticDecoy(master(variant(400_000, "640x360")))).toBe(false);
  expect(isAtlanticDecoy("#EXTM3U\n#EXTINF:6,\nseg.ts\n")).toBe(false);
});
