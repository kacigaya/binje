import { getLocales } from 'expo-localization';
import { en } from './en';
import { fr } from './fr';
import { getPreferences } from '../storage/preferences';

export const LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];
export type TranslationKey = keyof typeof en;
export const DEFAULT_LOCALE: Locale = 'en';
const messages = { en, fr };

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fr';
}

export function localeFromTags(tags: readonly (string | null | undefined)[]): Locale {
  for (const tag of tags) {
    const language = tag?.toLowerCase().split(/[-_]/)[0];
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}

export async function resolveLocale(deviceLocales = getLocales()): Promise<Locale> {
  const preference = await getPreferences();
  if (preference.locale) return preference.locale;
  return localeFromTags(deviceLocales.map(item => item.languageTag ?? item.languageCode));
}

export function translate(locale: Locale, key: TranslationKey): string {
  return messages[locale][key] ?? en[key];
}

export { en, fr };
