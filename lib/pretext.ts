import { prepare, layout, type PreparedText } from "@chenglou/pretext";

export const FONTS = {
  body: "Outfit, sans-serif",
  heading: "Space Grotesk, sans-serif",
} as const;

export type FontKey = keyof typeof FONTS;

const cache = new Map<string, PreparedText>();

function cacheKey(text: string, font: string, fontSize: number): string {
  return `${font}::${fontSize}::${text}`;
}

export function prepareText(
  text: string,
  fontKey: FontKey,
  fontSize: number,
): PreparedText {
  const font = FONTS[fontKey];
  const key = cacheKey(text, font, fontSize);
  let prepared = cache.get(key);
  if (!prepared) {
    prepared = prepare(text, `${fontSize}px ${font}`);
    cache.set(key, prepared);
  }
  return prepared;
}

export function measureLines(
  text: string,
  fontKey: FontKey,
  fontSize: number,
  containerWidth: number,
  lineHeight: number,
): { lineCount: number; height: number } {
  const prepared = prepareText(text, fontKey, fontSize);
  return layout(prepared, containerWidth, lineHeight);
}

export function wouldTruncate(
  text: string,
  fontKey: FontKey,
  fontSize: number,
  containerWidth: number,
  lineHeight: number,
  maxLines: number,
): boolean {
  const { lineCount } = measureLines(
    text,
    fontKey,
    fontSize,
    containerWidth,
    lineHeight,
  );
  return lineCount > maxLines;
}
