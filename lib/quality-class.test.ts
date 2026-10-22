import { expect, test } from "bun:test";
import { qualityClass } from "@/lib/quality-class";

test("names cropped widescreen renditions by their 16:9 class", () => {
  expect(qualityClass(1920, 800)).toBe(1080);
  expect(qualityClass(1280, 534)).toBe(720);
  expect(qualityClass(640, 266)).toBe(360);
  expect(qualityClass(3840, 1600)).toBe(2160);
});

test("keeps standard labels for 16:9, narrower frames and unknown widths", () => {
  expect(qualityClass(1920, 1080)).toBe(1080);
  expect(qualityClass(1440, 1080)).toBe(1080);
  expect(qualityClass(undefined, 720)).toBe(720);
  expect(qualityClass(0, 480)).toBe(480);
});

test("maps scaled renditions to familiar quality labels", () => {
  expect(qualityClass(2592, 1458)).toBe(1440);
  expect(qualityClass(1728, 972)).toBe(1080);
  expect(qualityClass(1296, 729)).toBe(720);
  expect(qualityClass(864, 486)).toBe(480);
  expect(qualityClass(undefined, 972)).toBe(1080);
});

test("keeps standard labels across the quality ladder", () => {
  for (const height of [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320]) {
    expect(qualityClass(undefined, height)).toBe(height);
  }
});

test("keeps missing or invalid dimensions unknown", () => {
  expect(qualityClass(undefined, 0)).toBe(0);
  expect(qualityClass(0, 0)).toBe(0);
  expect(qualityClass(undefined, NaN)).toBe(0);
  expect(qualityClass(undefined, Infinity)).toBe(0);
});
