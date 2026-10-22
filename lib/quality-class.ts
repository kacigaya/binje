const STANDARD_HEIGHTS = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320];

// Use the nearest standard 16:9 class so cropped or scaled streams keep familiar labels.
export function qualityClass(width: number | undefined, height: number): number {
  const equivalent = Math.max(height, width ? (width * 9) / 16 : 0);
  if (!Number.isFinite(equivalent) || equivalent <= 0) return 0;
  return STANDARD_HEIGHTS.reduce((nearest, standard) =>
    Math.abs(standard - equivalent) < Math.abs(nearest - equivalent) ? standard : nearest,
  );
}
