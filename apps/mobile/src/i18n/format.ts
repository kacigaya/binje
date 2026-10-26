import type { Locale } from './index';

const ratingFormatters = new Map<Locale, Intl.NumberFormat>();

/** Match the web rating format: one decimal in the user's locale. Returns null for unrated titles. */
export function formatRating(locale: Locale, value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  let formatter = ratingFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    ratingFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}
