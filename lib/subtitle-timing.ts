// Timing helpers shared by the player and the server's audio sync. A sync maps
// a subtitle file's time onto the video: video = subtitle * scale + offset.
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

export type Fit = { rank: 0 | 1 | 2; scale: number };

/**
 * How plausibly a file belongs to this video, from its last line: 0 when it
 * ends in the video's last fifth, 1 when it ends earlier (a partial file, or
 * just long credits), 2 when it runs past the end. Credits make "ends early"
 * normal, so only running past the end is treated as a timing fault: a file
 * timed for a film-rate release runs 4% long on a 25 fps video, and is
 * compressed by the frame-rate ratio when that makes it fit.
 */
export function fitToDuration(lastEnd: number, duration: number): Fit {
  if (!(lastEnd > 0) || !(duration > 0)) return { rank: 1, scale: 1 };
  const fits = (end: number) => end <= duration * 1.005 && end >= duration * 0.8;
  if (lastEnd <= duration * 1.005) return { rank: fits(lastEnd) ? 0 : 1, scale: 1 };
  return fits(lastEnd * SCALES[2]) ? { rank: 0, scale: SCALES[2] } : { rank: 2, scale: 1 };
}

export function applySync(time: number, sync: SubtitleSync) {
  return time * sync.scale + sync.offset;
}
