import { expect, test } from "bun:test";
import { tmdbImageLoader } from "./image-loader";

test("selects a TMDB variant without exceeding the original preset", () => {
  const src = "https://image.tmdb.org/t/p/w342/poster.jpg";
  expect(tmdbImageLoader({ src, width: 160 })).toBe("https://image.tmdb.org/t/p/w185/poster.jpg");
  expect(tmdbImageLoader({ src, width: 640 })).toBe(src);
});

test("uses the logo and backdrop presets and preserves original URLs", () => {
  expect(tmdbImageLoader({ src: "https://image.tmdb.org/t/p/w500/logo.png", width: 300 }))
    .toBe("https://image.tmdb.org/t/p/w300/logo.png");
  expect(tmdbImageLoader({ src: "https://image.tmdb.org/t/p/w1280/hero.jpg", width: 640 }))
    .toBe("https://image.tmdb.org/t/p/w780/hero.jpg");
  const original = "https://image.tmdb.org/t/p/original/art.jpg";
  expect(tmdbImageLoader({ src: original, width: 640 })).toBe(original);
});
