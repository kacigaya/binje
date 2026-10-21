import { expect, test } from "bun:test";
import { streamhgLinks } from "./twoembed";

test("orders StreamHG variants with the player-hosted one first", () => {
  const html = `<script>var links={"hls3":"https://cdn3.test/x/master.txt","hls2":"https://cdn2.test/master.m3u8?t=1","hls4":"/stream/abc/master.m3u8"};</script>`;
  expect(streamhgLinks(html, "https://player.test/e/file1")).toEqual([
    "https://player.test/stream/abc/master.m3u8",
    "https://cdn2.test/master.m3u8?t=1",
    "https://cdn3.test/x/master.txt",
  ]);
  expect(streamhgLinks("<html>File not found</html>", "https://player.test/e/x")).toEqual([]);
});
