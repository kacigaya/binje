import { expect, test } from "bun:test";
import { getTargetUrl, isSafeHost } from "@/lib/safe-fetch";

test("getTargetUrl keeps http and https targets only", () => {
  expect(getTargetUrl("https://cdn.test/video.m3u8")?.href).toBe("https://cdn.test/video.m3u8");
  expect(getTargetUrl("file:///etc/passwd")).toBeNull();
  expect(getTargetUrl("javascript:alert(1)")).toBeNull();
  expect(getTargetUrl(null)).toBeNull();
});

test("isSafeHost blocks private and loopback addresses", async () => {
  expect(await isSafeHost(new URL("http://127.0.0.1/stream.m3u8"))).toBe(false);
  expect(await isSafeHost(new URL("http://192.168.1.10/stream.m3u8"))).toBe(false);
  expect(await isSafeHost(new URL("http://[::1]/stream.m3u8"))).toBe(false);
  expect(await isSafeHost(new URL("http://localhost/stream.m3u8"))).toBe(false);
});
