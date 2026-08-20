import { describe, expect, test } from "bun:test";
import { selectCastTransport } from "./cast-transport";

const unavailable = {
  googleConnected: false,
  googleAvailable: false,
  remotePlaybackConnected: false,
  remotePlaybackSupported: false,
  airPlayConnected: false,
  airPlayAvailable: false,
};

describe("selectCastTransport", () => {
  test("keeps an active connection before selecting another transport", () => {
    expect(
      selectCastTransport({
        ...unavailable,
        remotePlaybackConnected: true,
        googleAvailable: true,
      }),
    ).toBe("remote-playback");
  });

  test("prefers Google Cast when its receiver is compatible", () => {
    expect(
      selectCastTransport({
        ...unavailable,
        googleAvailable: true,
        remotePlaybackSupported: true,
        airPlayAvailable: true,
      }),
    ).toBe("google");
  });

  test("falls back to browser remote playback when CAF filters out the device", () => {
    expect(
      selectCastTransport({
        ...unavailable,
        remotePlaybackSupported: true,
        airPlayAvailable: true,
      }),
    ).toBe("remote-playback");
  });

  test("uses AirPlay when no Google or browser remote transport exists", () => {
    expect(selectCastTransport({ ...unavailable, airPlayAvailable: true })).toBe("airplay");
  });

  test("returns null when the browser exposes no casting transport", () => {
    expect(selectCastTransport(unavailable)).toBeNull();
  });
});
