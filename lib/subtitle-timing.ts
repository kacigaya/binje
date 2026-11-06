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

export type Cue = { start: number; end: number; text: string };

const TIMING_LINE = new RegExp(`^\\s*${TIMESTAMP.source}\\s*-->\\s*${TIMESTAMP.source}`);

// Players without <track> draw cues as plain text: drop VTT tags and SSA overrides such as {\an8}.
function plainLine(line: string) {
  return line
    .replace(/<[^>]*>/g, "")
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, "\u00a0").replace(/&lrm;|&rlm;/g, "").replace(/&amp;/g, "&")
    .trim();
}

/** Every cue of a WebVTT or SRT file in file time, in start order, as plain text. */
export function parseCues(text: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((line) => line.includes("-->"));
    const match = at < 0 ? null : TIMING_LINE.exec(lines[at]);
    if (!match) continue;
    const start = seconds(match, 1);
    const end = seconds(match, 5);
    const body = lines.slice(at + 1).map(plainLine).filter(Boolean).join("\n");
    if (end > start && body) cues.push({ start, end, text: body });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function applySync(time: number, sync: SubtitleSync) {
  return time * sync.scale + sync.offset;
}
