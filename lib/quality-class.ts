// Name widescreen quality by its equivalent 16:9 frame: 1920x800 counts as 1080p.
// For narrower frames or missing width, use height.
export function qualityClass(width: number | undefined, height: number): number {
  return Math.round(Math.max(height, width ? (width * 9) / 16 : 0));
}
