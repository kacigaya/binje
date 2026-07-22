import { describe, expect, test } from "bun:test";
import { parseTsCodecs } from "./stream-probe";

const TS_PACKET_SIZE = 188;

function packet(pid: number, payload: number[]) {
  const data = new Uint8Array(TS_PACKET_SIZE).fill(0xff);
  data[0] = 0x47;
  data[1] = 0x40 | ((pid >> 8) & 0x1f);
  data[2] = pid & 0xff;
  data[3] = 0x10;
  data.set(payload, 4);
  return data;
}

const PAT = packet(0, [
  0x00,
  0x00, 0xb0, 0x0d,
  0x00, 0x01, 0xc1, 0x00, 0x00,
  0x00, 0x01, 0xe1, 0x00,
  0x00, 0x00, 0x00, 0x00,
]);

function pmt(streams: [number, number][]) {
  const es = streams.flatMap(([type, pid]) => [
    type, 0xe0 | ((pid >> 8) & 0x1f), pid & 0xff, 0xf0, 0x00,
  ]);
  const sectionLength = 9 + es.length + 4;
  return packet(0x100, [
    0x00,
    0x02, 0xb0, sectionLength,
    0x00, 0x01, 0xc1, 0x00, 0x00,
    0xe1, 0x00,
    0xf0, 0x00,
    ...es,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

const ADTS_5_1 = [0xff, 0xf1, 0x51, 0x80, 0x00, 0x1f, 0xfc];

function concat(...parts: (Uint8Array | number[])[]) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

describe("parseTsCodecs", () => {
  test("detects H264 + AAC 5.1", () => {
    const data = concat(PAT, pmt([[0x1b, 0x100], [0x0f, 0x101]]), ADTS_5_1);
    expect(parseTsCodecs(data)).toEqual({ video: "H264", audio: "AAC 5.1" });
  });

  test("detects HEVC + Dolby Digital+", () => {
    const data = concat(PAT, pmt([[0x24, 0x100], [0x87, 0x101]]));
    expect(parseTsCodecs(data)).toEqual({
      video: "HEVC",
      audio: "Dolby Digital+",
    });
  });

  test("returns nulls on garbage", () => {
    expect(parseTsCodecs(new Uint8Array(400).fill(0xab))).toEqual({
      video: null,
      audio: null,
    });
  });

  test("AAC without ADTS header stays plain AAC", () => {
    const data = concat(PAT, pmt([[0x1b, 0x100], [0x0f, 0x101]]));
    expect(parseTsCodecs(data)).toEqual({ video: "H264", audio: "AAC" });
  });
});
