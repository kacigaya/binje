export type CastTransport = "google" | "remote-playback" | "airplay";

export function selectCastTransport({
  googleConnected,
  googleAvailable,
  remotePlaybackConnected,
  remotePlaybackSupported,
  airPlayConnected,
  airPlayAvailable,
}: {
  googleConnected: boolean;
  googleAvailable: boolean;
  remotePlaybackConnected: boolean;
  remotePlaybackSupported: boolean;
  airPlayConnected: boolean;
  airPlayAvailable: boolean;
}): CastTransport | null {
  if (googleConnected) return "google";
  if (remotePlaybackConnected) return "remote-playback";
  if (airPlayConnected) return "airplay";
  if (googleAvailable) return "google";
  if (remotePlaybackSupported) return "remote-playback";
  if (airPlayAvailable) return "airplay";
  return null;
}
