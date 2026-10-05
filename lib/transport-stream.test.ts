import { expect, test } from "bun:test";
import { unwrapTransportStream } from "./transport-stream";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function chunk(type: string, data: number[] = []) {
  const length = [data.length >>> 24, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255];
  return [...length, ...Array.from(type, (char) => char.charCodeAt(0)), ...data, 0, 0, 0, 0];
}

function transportStream(packets: number) {
  return Array.from({ length: packets * 188 }, (_, index) => (index % 188 === 0 ? 0x47 : 0x11));
}

test("strips a complete PNG placed in front of a transport stream", () => {
  const ts = transportStream(3);
  const bytes = new Uint8Array([...PNG_SIGNATURE, ...chunk("IHDR", Array(13).fill(1)), ...chunk("IEND"), ...ts]);
  expect(Array.from(unwrapTransportStream(bytes) ?? [])).toEqual(ts);
});

test("accepts a transport stream that is only mislabeled", () => {
  const bytes = new Uint8Array(transportStream(2));
  expect(unwrapTransportStream(bytes)?.byteLength).toBe(376);
});

test("rejects real images, truncated PNGs and other bodies", () => {
  expect(unwrapTransportStream(new Uint8Array([...PNG_SIGNATURE, ...chunk("IHDR", Array(13).fill(1)), ...chunk("IEND")]))).toBeNull();
  expect(unwrapTransportStream(new Uint8Array([...PNG_SIGNATURE, ...chunk("IHDR", Array(13).fill(1))]))).toBeNull();
  expect(unwrapTransportStream(new TextEncoder().encode("<html>blocked</html>"))).toBeNull();
  expect(unwrapTransportStream(new Uint8Array([0x47, ...Array(200).fill(0)]))).toBeNull();
});
