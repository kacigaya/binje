// SRT to WebVTT, which <track> and Cast receivers read. SRT cues differ only
// by the comma before milliseconds; numeric cue indexes are valid VTT ids.
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/(\d+:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .trim();
  return `WEBVTT\n\n${body}\n`;
}
