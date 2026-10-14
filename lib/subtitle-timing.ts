// Map subtitle time to video time: video = subtitle * scale + offset.
export type SubtitleSync = { offset: number; scale: number };

export const NO_SYNC: SubtitleSync = { offset: 0, scale: 1 };

// PAL releases run 25 fps, film releases 23.976: the same lines land about 4%
// apart and drift further the longer the video runs.
const PAL = 25;
const FILM = 24000 / 1001;
export const SCALES = [1, PAL / FILM, FILM / PAL] as const;

const TIMESTAMP = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{3})/;
const CUE_LINE = new RegExp(`${TIMESTAMP.source}\\s*-->\\s*${TIMESTAMP.source}`, "g");

function seconds(match: string[], at: number) {
  const [h, m, s, ms] = match.slice(at, at + 4).map((part) => Number(part ?? 0));
  return h * 3600 + m * 60 + s + ms / 1000;
}

/** Start and end of every cue in a WebVTT or SRT file, in file time. */
export function cueTimes(text: string): [start: number, end: number][] {
  return [...text.matchAll(CUE_LINE)]
    .map((match) => [seconds(match, 1), seconds(match, 5)] as [number, number])
    .filter(([start, end]) => end > start);
}

export function applySync(time: number, sync: SubtitleSync) {
  return time * sync.scale + sync.offset;
}
