import AsyncStorage from '@react-native-async-storage/async-storage';

export type Consent = 'accepted' | 'dismissed';
export const CONSENT_STORAGE_KEY = 'binje:mobile:consent:v1';
const listeners = new Set<() => void>();

export async function getConsent(): Promise<Consent | null> {
  try {
    const value = await AsyncStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'accepted' || value === 'dismissed' ? value : null;
  } catch {
    return null;
  }
}

export async function setConsent(value: Consent): Promise<void> {
  await AsyncStorage.setItem(CONSENT_STORAGE_KEY, value);
  listeners.forEach(listener => listener());
}

export async function clearConsent(): Promise<void> {
  await AsyncStorage.removeItem(CONSENT_STORAGE_KEY);
  listeners.forEach(listener => listener());
}

export function subscribeToConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
