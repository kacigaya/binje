import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Locale } from '../i18n';

export const PREFERENCES_STORAGE_KEY = 'binje:mobile:preferences:v1';
export interface Preferences { locale?: Locale }

function valid(value: unknown): value is Preferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const locale = (value as Record<string, unknown>).locale;
  return locale === undefined || locale === 'en' || locale === 'fr';
}

export async function getPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : {};
  } catch { return {}; }
}

export async function setLocalePreference(locale: Locale): Promise<void> {
  const current = await getPreferences();
  await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ ...current, locale }));
}

export async function clearLocalePreference(): Promise<void> {
  const current = await getPreferences();
  delete current.locale;
  await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(current));
}
