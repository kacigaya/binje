import { expect, test } from "bun:test";
import { qualityClass } from "@/lib/quality-class";

test("names cropped widescreen renditions by their 16:9 class", () => {
  expect(qualityClass(1920, 800)).toBe(1080);
  expect(qualityClass(1280, 534)).toBe(720);
  expect(qualityClass(640, 266)).toBe(360);
  expect(qualityClass(3840, 1600)).toBe(2160);
});

test("keeps the height for 16:9, narrower frames and unknown widths", () => {
  expect(qualityClass(1920, 1080)).toBe(1080);
  expect(qualityClass(1440, 1080)).toBe(1080);
  expect(qualityClass(undefined, 720)).toBe(720);
  expect(qualityClass(0, 480)).toBe(480);
});
