// Quality names follow the 16:9 frame a rendition fills, so a 2.40:1 film
// cropped to 1920x800 reads 1080p like a letterboxed 1920x1080 upload. A
// narrower frame (4:3) is named by its height. Without a width, height alone.
export function qualityClass(width: number | undefined, height: number): number {
  return Math.round(Math.max(height, width ? (width * 9) / 16 : 0));
}
