import { expect, test } from "bun:test";
import { decodeVidnest, vidnestCandidates } from "./vidnest";

const ALPHABET = "RB0fpH8ZEyVLkv7c2i6MAJ5u3IKFDxlS1NTsnGaqmXYdUrtzjwObCgQP94hoeW+/";
const STANDARD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

test("decodes base64 written in Vidnest's shuffled alphabet", () => {
  const plain = JSON.stringify({ url: "https://cdn.test/master.m3u8" });
  const encoded = Array.from(Buffer.from(plain).toString("base64"), (char) => {
    const index = STANDARD.indexOf(char);
    return index < 0 ? char : ALPHABET[index];
  }).join("");
  expect(JSON.parse(decodeVidnest(encoded))).toEqual({ url: "https://cdn.test/master.m3u8" });
});

test("reads every backend shape and keeps original-language HLS only", () => {
  expect(vidnestCandidates({ url: "https://a.test/m.m3u8", headers: { Referer: "https://ref.test/", "User-Agent": "UA" } }))
    .toEqual([{ url: "https://a.test/m.m3u8", referer: "https://ref.test/", userAgent: "UA" }]);
  expect(vidnestCandidates({
    streams: [
      { url: "https://b.test/fr.m3u8", language: "French", type: "hls" },
      { url: "https://b.test/en.m3u8", language: "Original", type: "hls" },
      { url: "https://b.test/file.mp4", language: "English", type: "mp4" },
    ],
  }).map((candidate) => candidate.url)).toEqual(["https://b.test/en.m3u8"]);
  expect(vidnestCandidates({ all_urls: ["https://c.test/pl/x", "javascript:alert(1)"] }))
    .toEqual([{ url: "https://c.test/pl/x", referer: "https://vidnest.fun/", userAgent: undefined }]);
  expect(vidnestCandidates("404 page not found")).toEqual([]);
});
