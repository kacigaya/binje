import { expect, test } from "bun:test";
import { alignCues, audioPlaylist, mediaSegments, segmentWindow, speechActivity, STEP, windowParts } from "./subtitle-sync";
import { SCALES } from "./subtitle-timing";

// Deterministic pseudo-random lines and noise.
function random(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function lines(seed: number, total: number): [number, number][] {
  const next = random(seed);
  const cues: [number, number][] = [];
  for (let t = 2; t < total; ) {
    const length = 1 + next() * 3;
    cues.push([t, t + length]);
    t += length + 0.5 + next() * 6;
  }
  return cues;
}

// Speech where the lines say it is, after the file is moved to video time,
// with some lines unspoken and some sounds without lines.
function speechFor(cues: [number, number][], from: number, seconds: number, map: (t: number) => number) {
  const next = random(7);
  const speech = new Float32Array(Math.round(seconds / STEP));
  for (const [start, end] of cues) {
    if (next() < 0.15) continue;
    for (let i = Math.floor((map(start) - from) / STEP); i < Math.ceil((map(end) - from) / STEP); i++) {
      if (i >= 0 && i < speech.length) speech[i] = 1;
    }
  }
  for (let i = 0; i < speech.length; i++) if (next() < 0.05) speech[i] = 1;
  return { start: from, speech };
}

// The opening and a middle window, as the sync route decodes them.
const windowsFor = (cues: [number, number][], map: (t: number) => number) =>
  [speechFor(cues, 0, 150, map), speechFor(cues, 600, 150, map)];

test("finds the offset that lines the file up with speech", () => {
  const cues = lines(1, 900);
  const result = alignCues(windowsFor(cues, (t) => t + 3.2), cues);
  expect(result?.scale).toBe(1);
  expect(result?.offset).toBeCloseTo(3.2, 1);
});

test("finds a frame-rate scale together with an early offset", () => {
  const cues = lines(2, 900);
  const result = alignCues(windowsFor(cues, (t) => t * SCALES[1] - 7.5), cues);
  expect(result?.scale).toBe(SCALES[1]);
  expect(result?.offset).toBeCloseTo(-7.5, 0);
});

test("gives up when speech has nothing to do with the file", () => {
  const next = random(3);
  const noise = () => new Float32Array(1500).map(() => (next() < 0.4 ? 1 : 0));
  expect(alignCues([{ start: 0, speech: noise() }, { start: 600, speech: noise() }], lines(4, 900))).toBeNull();
});

test("a silent opening does not dilute a usable dialogue window", () => {
  const cues = lines(1, 900);
  const middle = speechFor(cues, 600, 150, (t) => t + 3.2);
  const next = random(11);
  middle.speech = middle.speech.map((value) => next() < 0.35 ? 1 - value : value);
  const result = alignCues([{ start: 0, speech: new Float32Array(1500) }, middle], cues);
  expect(result?.scale).toBe(1);
  expect(result?.offset).toBeCloseTo(3.2, 1);
});

test("empty or constant audio cannot produce a timing correction", () => {
  const cues = lines(1, 900);
  expect(alignCues([], cues)).toBeNull();
  expect(alignCues([{ start: 0, speech: new Float32Array(1500) }], cues)).toBeNull();
  expect(alignCues([{ start: 0, speech: new Float32Array(1500).fill(1) }], cues)).toBeNull();
});

test("marks speech-band bursts above the local background, not steady sound", () => {
  const rate = 8000;
  const pcm = new Int16Array(rate * 8);
  // A steady 1 kHz bed, louder 1 kHz from 3 s to 4 s, and loud 60 Hz hum
  // throughout, which the speech band filters out.
  for (let i = 0; i < pcm.length; i++) {
    const tone = Math.sin((2 * Math.PI * 1000 * i) / rate);
    pcm[i] = (i >= rate * 3 && i < rate * 4 ? 6000 : 300) * tone + 9000 * Math.sin((2 * Math.PI * 60 * i) / rate);
  }
  const speech = speechActivity(pcm, rate);
  expect(speech.length).toBe(80);
  expect([...speech.slice(31, 40)].every((value) => value === 1)).toBe(true);
  expect([...speech.slice(0, 29), ...speech.slice(42)].every((value) => value === 0)).toBe(true);
});

test("picks a separate audio rendition, else the lowest-bandwidth variant", () => {
  const base = "http://127.0.0.1:3000/api/hls?url=x";
  expect(audioPlaylist("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=5000000\n/api/hls?url=hi\n#EXT-X-STREAM-INF:BANDWIDTH=800000\n/api/hls?url=lo\n", base))
    .toBe("http://127.0.0.1:3000/api/hls?url=lo");
  expect(audioPlaylist('#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",URI="/api/hls?url=aud"\n#EXT-X-STREAM-INF:BANDWIDTH=1\n/api/hls?url=v\n', base))
    .toBe("http://127.0.0.1:3000/api/hls?url=aud");
  expect(audioPlaylist("#EXTM3U\n#EXTINF:6,\nseg.ts\n", base)).toBe(base);
});

test("lists the init section and segments with their start times", () => {
  const base = "http://127.0.0.1:3000/api/hls?url=media";
  const playlist = '#EXTM3U\n#EXT-X-MAP:URI="/api/hls?url=init"\n#EXTINF:6.0,\n/api/hls?url=s1\n#EXTINF:6.0,\n/api/hls?url=s2\n#EXTINF:6.0,\n/api/hls?url=s3\n';
  const parsed = mediaSegments(playlist, base);
  expect(parsed.segments[0].init).toEqual({ url: "http://127.0.0.1:3000/api/hls?url=init", range: undefined });
  expect(parsed.total).toBe(18);
  expect(segmentWindow(parsed.segments, 5, 2).map((segment) => segment.url))
    .toEqual(["http://127.0.0.1:3000/api/hls?url=s1", "http://127.0.0.1:3000/api/hls?url=s2"]);
  expect(segmentWindow(parsed.segments, 12, 6).map((segment) => segment.start)).toEqual([12]);
  expect(mediaSegments('#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXTINF:6,\ns.ts\n', base).encrypted).toBe(true);
});

test("keeps byte ranges, following on from the previous range of the same file", () => {
  const playlist = '#EXTM3U\n#EXT-X-MAP:URI="v.mp4",BYTERANGE="800@0"\n#EXTINF:6,\n#EXT-X-BYTERANGE:1000@800\nv.mp4\n#EXTINF:6,\n#EXT-X-BYTERANGE:500\nv.mp4\n#EXTINF:6,\nother.ts\n';
  const parsed = mediaSegments(playlist, "https://cdn.test/a/media.m3u8");
  expect(parsed.segments[0].init).toEqual({ url: "https://cdn.test/a/v.mp4", range: { offset: 0, length: 800 } });
  expect(parsed.segments.map(({ url, range }) => [url, range])).toEqual([
    ["https://cdn.test/a/v.mp4", { offset: 800, length: 1000 }],
    ["https://cdn.test/a/v.mp4", { offset: 1800, length: 500 }],
    ["https://cdn.test/a/other.ts", undefined],
  ]);
});

test("uses the default audio of the chosen variant's group", () => {
  const base = "http://127.0.0.1:3000/api/hls?url=x";
  const master = [
    "#EXTM3U",
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="hi",NAME="Main",DEFAULT=YES,URI="/hi-main"',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="lo",NAME="Commentary",DEFAULT=NO,URI="/lo-commentary"',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="lo",NAME="Main",DEFAULT=YES,URI="/lo-main"',
    '#EXT-X-STREAM-INF:BANDWIDTH=5000000,AUDIO="hi"', "/v-hi",
    '#EXT-X-STREAM-INF:BANDWIDTH=800000,AUDIO="lo"', "/v-lo",
  ].join("\n");
  expect(audioPlaylist(master, base)).toBe("http://127.0.0.1:3000/lo-main");
  // Muxed audio: the rendition has no URI, so the variant itself is read.
  expect(audioPlaylist(master.replace(',URI="/lo-main"', ""), base)).toBe("http://127.0.0.1:3000/v-lo");
});

test("feeds each window the init section in effect, again when it changes", () => {
  const playlist = '#EXTM3U\n#EXT-X-MAP:URI="a.mp4"\n#EXTINF:6,\n1.m4s\n#EXTINF:6,\n2.m4s\n#EXT-X-DISCONTINUITY\n#EXT-X-MAP:URI="b.mp4"\n#EXTINF:6,\n3.m4s\n';
  const { segments } = mediaSegments(playlist, "https://cdn.test/");
  expect(windowParts(segments).map((part) => part.url.slice(17))).toEqual(["a.mp4", "1.m4s", "2.m4s", "b.mp4", "3.m4s"]);
  expect(windowParts(segmentWindow(segments, 12, 6)).map((part) => part.url.slice(17))).toEqual(["b.mp4", "3.m4s"]);
});
