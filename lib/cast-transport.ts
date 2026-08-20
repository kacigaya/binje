export type CastTransport = "google" | "airplay" | "tab-cast";

/**
 * Picks how the Cast button behaves.
 *
 * An established connection always wins so the button can stop it. Otherwise
 * the order is native Google Cast, AirPlay, then Chrome tab mirroring through
 * the local companion, which mirrors the whole tab and is the only option left
 * for receivers that refuse the media receiver app.
 */
export function selectCastTransport({
  googleConnected,
  googleAvailable,
  airPlayConnected,
  airPlayAvailable,
  tabCastConnected,
  tabCastAvailable,
}: {
  googleConnected: boolean;
  googleAvailable: boolean;
  airPlayConnected: boolean;
  airPlayAvailable: boolean;
  tabCastConnected: boolean;
  tabCastAvailable: boolean;
}): CastTransport | null {
  if (googleConnected) return "google";
  if (airPlayConnected) return "airplay";
  if (tabCastConnected) return "tab-cast";
  if (googleAvailable) return "google";
  if (airPlayAvailable) return "airplay";
  if (tabCastAvailable) return "tab-cast";
  return null;
}
