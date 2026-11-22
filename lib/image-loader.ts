import type { ImageLoaderProps } from "next/image";

const tmdbImage = /^(https:\/\/image\.tmdb\.org\/t\/p\/)(w\d+)(\/[^/?#]+)$/;
const posterWidths = [92, 154, 185, 342, 500, 780];
const widthsBySize: Readonly<Record<string, readonly number[]>> = {
  w92: [92],
  w185: [45, 185],
  w300: [92, 185, 300],
  w342: posterWidths.slice(0, 4),
  w500: posterWidths.slice(0, 5),
  w780: [300, 780],
  w1280: [300, 780, 1280],
};

export function tmdbImageLoader({ src, width }: ImageLoaderProps) {
  const match = tmdbImage.exec(src);
  if (!match) return src;
  const [, base, size, file] = match;
  const widths = size === "w500" && file.endsWith(".png") ? [45, 92, 154, 185, 300, 500] : widthsBySize[size];
  const target = widths?.find((candidate) => candidate >= width);
  return target ? `${base}w${target}${file}` : src;
}
