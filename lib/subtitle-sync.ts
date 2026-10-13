import { SCALES, type SubtitleSync } from "@/lib/subtitle-timing";

// Audio sync in the spirit of ffsubsync: mark where speech is, mark where the
// file shows lines, and slide one over the other until they agree most.
export const STEP = 0.1; // seconds per frame
export const MAX_SHIFT = 60; // seconds either way
// Speech sits in the telephone band; a frame counts as speech when that band
// is this much louder than the sound around it, so music beds and room tone
// that stay level are ignored.
const SPEECH_LOW_HZ = 300;
const SPEECH_HIGH_HZ = 3000;
const BACKGROUND_SECONDS = 3;
const SPEECH_RISE_DB = 9;
// The best shift must stand this far, as a share of its score, above any
// shift more than PEAK_WIDTH away; tuned on real episodes, where wrong
// scales and noise came out under 0.1 and right answers over 0.3.
const MIN_PROMINENCE = 0.15;
const PEAK_WIDTH = 3;
// And agree with the speech at all: right answers on real episodes averaged
// about 0.27 per window, chance lands near 0.03.
const MIN_CORRELATION = 0.12;

function biquad(samples: Float32Array, rate: number, kind: "highpass" | "lowpass", frequency: number) {
  const w = (2 * Math.PI * frequency) / rate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / Math.SQRT2;
  const b = kind === "lowpass" ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  const a0 = 1 + alpha;
  const [b0, b1, b2, a1, a2] = [b[0] / a0, b[1] / a0, b[2] / a0, (-2 * cos) / a0, (1 - alpha) / a0];
  const out = new Float32Array(samples.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** 1 for each STEP of mono 16-bit PCM that sounds like speech, else 0. */
export function speechActivity(pcm: Int16Array, sampleRate: number): Float32Array {
  const band = biquad(biquad(Float32Array.from(pcm), sampleRate, "highpass", SPEECH_LOW_HZ), sampleRate, "lowpass", SPEECH_HIGH_HZ);
  const frame = Math.round(sampleRate * STEP);
  const count = Math.floor(band.length / frame);
  const levels = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let j = i * frame; j < (i + 1) * frame; j++) sum += band[j] * band[j];
    levels[i] = 10 * Math.log10(sum / frame + 1);
  }
  const reach = Math.round(BACKGROUND_SECONDS / STEP);
  return levels.map((level, i) => {
    const around = levels.slice(Math.max(0, i - reach), i + reach + 1).sort();
    return level - around[Math.floor(around.length * 0.2)] > SPEECH_RISE_DB ? 1 : 0;
  });
}

export type SpeechWindow = { start: number; speech: Float32Array };

/**
 * Pearson correlation between a window's speech and the file's lines, for
 * every shift in ±MAX_SHIFT. A line at file time t lands at video time
 * t * scale + shift.
 */
function correlations(window: SpeechWindow, cues: [number, number][], scale: number): Float32Array {
  const frames = window.speech.length;
  const pad = Math.round(MAX_SHIFT / STEP);
  const mask = new Float32Array(frames + 2 * pad);
  for (const [start, end] of cues) {
    const from = Math.max(0, Math.floor((start * scale - window.start) / STEP) + pad);
    const to = Math.min(mask.length, Math.ceil((end * scale - window.start) / STEP) + pad);
    for (let i = from; i < to; i++) mask[i] = 1;
  }
  let mean = 0;
  for (const value of window.speech) mean += value;
  mean /= frames || 1;
  const voice = window.speech.map((value) => value - mean);
  const voiceNorm = Math.sqrt(voice.reduce((sum, value) => sum + value * value, 0)) || 1;
  const result = new Float32Array(2 * pad + 1);
  for (let shift = -pad; shift <= pad; shift++) {
    // At shift o, video frame i shows the line at mask index i - o + pad.
    let covered = 0;
    for (let i = 0; i < frames; i++) covered += mask[i - shift + pad];
    const lineMean = covered / (frames || 1);
    let product = 0;
    let lineNorm = 0;
    for (let i = 0; i < frames; i++) {
      const line = mask[i - shift + pad] - lineMean;
      product += voice[i] * line;
      lineNorm += line * line;
    }
    result[shift + pad] = lineNorm ? product / (voiceNorm * Math.sqrt(lineNorm)) : 0;
  }
  return result;
}

/**
 * The offset and frame-rate scale that best line the file's cues up with the
 * speech in every window together, or null when no shift stands out.
 */
export function alignCues(windows: SpeechWindow[], cues: [number, number][]): (SubtitleSync & { confidence: number }) | null {
  const pad = Math.round(MAX_SHIFT / STEP);
  const width = Math.round(PEAK_WIDTH / STEP);
  let best: { score: number; shift: number; scale: number; scores: Float32Array } | null = null;
  for (const scale of SCALES) {
    const scores = new Float32Array(2 * pad + 1);
    for (const window of windows) {
      correlations(window, cues, scale).forEach((value, i) => (scores[i] += value));
    }
    const score = Math.max(...scores);
    if (!best || score > best.score) best = { score, shift: scores.indexOf(score) - pad, scale, scores };
  }
  if (!best || best.score / windows.length < MIN_CORRELATION) return null;
  const { shift, scores } = best;
  let rival = -Infinity;
  scores.forEach((value, i) => {
    if (Math.abs(i - pad - shift) > width) rival = Math.max(rival, value);
  });
  const confidence = (best.score - rival) / best.score;
  if (confidence < MIN_PROMINENCE) return null;
  return { offset: Math.round(shift * STEP * 100) / 100, scale: best.scale, confidence };
}

// The cheapest playlist that carries the sound the player plays: the
// lowest-bandwidth variant, or the default rendition of that variant's audio
// group when the audio is separate (other renditions may be commentary or
// another language).
export function audioPlaylist(master: string, base: string): string {
  if (!master.includes("#EXT-X-STREAM-INF")) return base;
  const lines = master.split("\n").map((line) => line.trim());
  let best: { bandwidth: number; uri: string; audio?: string } | null = null;
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].startsWith("#EXT-X-STREAM-INF")) continue;
    const bandwidth = Number(lines[index].match(/BANDWIDTH=(\d+)/)?.[1] ?? Infinity);
    const audio = lines[index].match(/AUDIO="([^"]+)"/)?.[1];
    const uri = lines.slice(index + 1).find((next) => next && !next.startsWith("#"));
    if (uri && (!best || bandwidth < best.bandwidth)) best = { bandwidth, uri, audio };
  }
  if (!best) return base;
  const renditions = lines.filter((line) => line.startsWith("#EXT-X-MEDIA:") && /TYPE=AUDIO/.test(line) &&
    (!best.audio || line.includes(`GROUP-ID="${best.audio}"`)));
  // A rendition without a URI is carried inside the variant itself.
  const rendition = renditions.find((line) => /DEFAULT=YES/.test(line)) ?? renditions[0];
  const uri = rendition?.match(/URI="([^"]+)"/)?.[1];
  return new URL(uri ?? best.uri, base).href;
}

// `#EXT-X-BYTERANGE:<length>[@<offset>]`; without an offset the range
// follows the previous one of the same file.
export type Part = { url: string; range?: { offset: number; length: number } };

function byteRange(value: string, url: string, ends: Map<string, number>) {
  const [length, offset] = value.split("@").map(Number);
  if (!(length > 0)) return undefined;
  const from = Number.isFinite(offset) ? offset : (ends.get(url) ?? 0);
  ends.set(url, from + length);
  return { offset: from, length };
}

export type Segment = Part & { start: number; duration: number; init?: Part };

/**
 * Every segment of a media playlist with its start time, byte range and the
 * init section in effect for it (a playlist may switch maps at a
 * discontinuity). Encrypted playlists are reported rather than decoded.
 */
export function mediaSegments(playlist: string, base: string) {
  const segments: Segment[] = [];
  const ends = new Map<string, number>();
  let init: Part | undefined;
  let encrypted = false;
  let total = 0;
  let duration = 0;
  let range: string | undefined;
  for (const raw of playlist.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#EXT-X-KEY") && !/METHOD=NONE/.test(line)) encrypted = true;
    else if (line.startsWith("#EXT-X-MAP")) {
      const uri = line.match(/URI="([^"]+)"/)?.[1];
      if (uri) {
        const url = new URL(uri, base).href;
        const mapRange = line.match(/BYTERANGE="([^"]+)"/)?.[1];
        init = { url, range: mapRange ? byteRange(mapRange, url, new Map()) : undefined };
      }
    } else if (line.startsWith("#EXTINF:")) duration = Number.parseFloat(line.slice(8)) || 0;
    else if (line.startsWith("#EXT-X-BYTERANGE:")) range = line.slice(17);
    else if (line && !line.startsWith("#")) {
      const url = new URL(line, base).href;
      segments.push({ url, range: range ? byteRange(range, url, ends) : undefined, start: total, duration, init });
      range = undefined;
      total += duration;
    }
  }
  return { segments, total, encrypted };
}

/** A window's bytes in order: each segment, after its init when that changes. */
export function windowParts(window: Segment[]): Part[] {
  const parts: Part[] = [];
  let current: Part | undefined;
  for (const { url, range, init } of window) {
    if (init && (init.url !== current?.url || init.range?.offset !== current?.range?.offset)) parts.push(init);
    current = init;
    parts.push({ url, range });
  }
  return parts;
}

/** The segments covering `seconds` of playback from `from`. */
export function segmentWindow<T extends { start: number; duration: number }>(segments: T[], from: number, seconds: number): T[] {
  return segments.filter((segment) => segment.start + segment.duration > from && segment.start < from + seconds);
}
