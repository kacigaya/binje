import { expect, test } from "bun:test";
import { extractM3u8, unpackPacked } from "./uqload";

// A real-shaped uqload embed: jwplayer setup wrapped in a Dean Edwards packer.
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
});
