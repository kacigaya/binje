export const CONSENT_STORAGE_KEY = "binje:cookie-consent";

type ConsentValue = "accepted" | "dismissed";

export function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (value === "accepted" || value === "dismissed") return value;
    return null;
  } catch {
    return null;
  }
}

/** Watch history and the watchlist are only written once storage is accepted. */
export function hasStorageConsent(): boolean {
  return getConsent() === "accepted";
}

export function setConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
  }
}
