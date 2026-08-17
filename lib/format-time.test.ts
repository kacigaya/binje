import { describe, expect, test } from "bun:test";
import { formatPlaybackTime } from "@/lib/format-time";

describe("formatPlaybackTime", () => {
  test("drops the hour segment below an hour", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(9)).toBe("0:09");
    expect(formatPlaybackTime(411)).toBe("6:51");
    expect(formatPlaybackTime(3599)).toBe("59:59");
  });

  test("pads minutes once the hour segment appears", () => {
    expect(formatPlaybackTime(3600)).toBe("1:00:00");
    expect(formatPlaybackTime(6628)).toBe("1:50:28");
    expect(formatPlaybackTime(7272)).toBe("2:01:12");
  });

  test("floors fractional seconds and clamps negatives", () => {
    expect(formatPlaybackTime(708.94)).toBe("11:48");
    expect(formatPlaybackTime(-5)).toBe("0:00");
  });
});
