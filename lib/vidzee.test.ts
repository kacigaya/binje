import { afterEach, expect, mock, test } from "bun:test";
import { resolveVidzeeStream, vidzeeSubtitles } from "./vidzee";
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("resolves English TV with optional, validated subtitles and referer", async () => {
  const urls: string[] = [];
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    urls.push(String(input));
    return Response.json(String(input).includes("/subs/")
      ? [{ file: "javascript:alert(1)" }, { file: "https://subs.test/en.vtt", label: "English" }]
      : { url: "https://cdn.test/master", headers: { Referer: "https://origin.test/", Cookie: "ignored" } });
  }) as unknown as typeof fetch;
  const result = await resolveVidzeeStream({ type: "tv", id: "101", season: "2", episode: "3" });
  expect(urls).toContain("https://core.vidzee.wtf/streams/tv/101/2/3?s=v4%3AEnglish");
  expect(result.tracks).toEqual([{ file: "https://subs.test/en.vtt", label: "English" }]);
  expect(result.referer).toBe("https://origin.test/");
});

test("subtitle failure does not prevent playback", async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) => String(input).includes("/subs/")
    ? new Response(null, { status: 503 }) : Response.json({ url: "https://cdn.test/master" })) as unknown as typeof fetch;
  expect((await resolveVidzeeStream({ type: "movie", id: "102", season: "1", episode: "1" })).tracks).toEqual([]);
});

test("rejects invalid upstream URLs and invalid coordinates", async () => {
  globalThis.fetch = mock(async () => Response.json({ url: "file:///etc/passwd" })) as unknown as typeof fetch;
  await expect(resolveVidzeeStream({ type: "movie", id: "103", season: "1", episode: "1" })).rejects.toThrow();
  await expect(resolveVidzeeStream({ type: "tv", id: "104", season: "0", episode: "1" })).rejects.toThrow();
});

test("lists subtitles while the stream is down", async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) => String(input).includes("/subs/")
    ? Response.json([{ file: "https://subs.test/fr.vtt", label: "French" }])
    : new Response(null, { status: 503 })) as unknown as typeof fetch;
  const media = { type: "tv", id: "105", season: "1", episode: "1" } as const;
  await expect(resolveVidzeeStream(media)).rejects.toThrow();
  expect(await vidzeeSubtitles(media)).toEqual([{ file: "https://subs.test/fr.vtt", label: "French" }]);
});
