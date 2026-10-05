import { afterEach, expect, mock, test } from "bun:test";
import { createVsrcResolver, parsePlayerConfig } from "./vsrc";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function page(servers: unknown[]) {
  const config = { type: "movie", id: "tt1", t: "signed", ssr: { status: "ok", servers } };
  return `<html><head><base href="/pl/"></head><script>\n  var Q = ${JSON.stringify(config)};\n</script></html>`;
}

test("parses the embedded server list and the player's base path", () => {
  const config = parsePlayerConfig(page([{ ref: "a", lang: null }, { ref: "b", lang: "French" }, { nope: 1 }]), "https://203.0.113.50/embed/movie/1");
  expect(config.token).toBe("signed");
  expect(config.servers).toEqual([{ ref: "a", lang: null }, { ref: "b", lang: "French" }]);
  expect(config.base.href).toBe("https://203.0.113.50/pl/");
  expect(() => parsePlayerConfig("<html></html>", "https://203.0.113.50/")).toThrow("Missing player config.");
});

test("mints untagged servers in order, skips dubs and pins the minting User-Agent", async () => {
  const requests: { url: string; agent: string | null }[] = [];
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url: url.href, agent: new Headers(init?.headers).get("user-agent") });
    if (url.pathname.startsWith("/embed/")) {
      return new Response(page([{ ref: "dead", lang: null }, { ref: "dub", lang: "Hindi" }, { ref: "live", lang: "English" }]));
    }
    if (url.pathname === "/pl/api.php") {
      return url.searchParams.get("ref") === "dead"
        ? Response.json({ error: "unavailable" }, { status: 502 })
        : Response.json({ url: `/_stream?id=${url.searchParams.get("ref")}`, type: "hls" });
    }
    return new Response("#EXTM3U\n");
  }) as unknown as typeof fetch;

  const result = await createVsrcResolver("https://203.0.113.51")({
    type: "tv", id: "7", title: "Show", year: "2024", imdbId: "", season: "2", episode: "3",
  });
  expect(result.url).toBe("https://203.0.113.51/_stream?id=live");
  expect(result.referer).toBe("https://203.0.113.51/embed/tv/7/2/3");
  expect(requests.some((request) => request.url.includes("ref=dub"))).toBe(false);
  expect(new Set(requests.map((request) => request.agent))).toEqual(new Set([result.userAgent ?? null]));
});
