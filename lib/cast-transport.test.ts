import { describe, expect, test } from "bun:test";
import { selectCastTransport } from "./cast-transport";

const unavailable = {
  googleConnected: false,
  googleAvailable: false,
  airPlayConnected: false,
  airPlayAvailable: false,
  tabCastConnected: false,
  tabCastAvailable: false,
};

describe("selectCastTransport", () => {
  test("keeps an active connection before selecting another transport", () => {
    expect(
      selectCastTransport({
        ...unavailable,
        tabCastConnected: true,
        googleAvailable: true,
      }),
    ).toBe("tab-cast");
  });

  test("prefers Google Cast when its receiver is compatible", () => {
    expect(
      selectCastTransport({
        ...unavailable,
        googleAvailable: true,
        airPlayAvailable: true,
        tabCastAvailable: true,
      }),
    ).toBe("google");
  });

  test("prefers AirPlay over tab mirroring", () => {
    expect(
      selectCastTransport({
        ...unavailable,
        airPlayAvailable: true,
        tabCastAvailable: true,
      }),
    ).toBe("airplay");
  });

  test("falls back to tab mirroring when CAF filters out the device", () => {
    expect(selectCastTransport({ ...unavailable, tabCastAvailable: true })).toBe("tab-cast");
  });

  test("keeps an AirPlay session ahead of an available Google receiver", () => {
    expect(
      selectCastTransport({ ...unavailable, airPlayConnected: true, googleAvailable: true }),
    ).toBe("airplay");
  });

  test("returns null when the browser exposes no casting transport", () => {
    expect(selectCastTransport(unavailable)).toBeNull();
  });
});
