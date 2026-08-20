import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CHROME_DEBUG_PORT,
  DEFAULT_SERVER_PORT,
  parseOrigins,
  readCompanionConfig,
  SERVER_HOSTNAME,
} from "./config";

describe("parseOrigins", () => {
  test("normalizes, de-duplicates, and drops anything that is not an http origin", () => {
    expect(
      parseOrigins(
        "https://example.test/watch, https://example.test, ftp://example.test, nonsense, ",
      ),
    ).toEqual(["https://example.test"]);
  });

  test("returns nothing for an unset list", () => {
    expect(parseOrigins(undefined)).toEqual([]);
  });
});

describe("readCompanionConfig", () => {
  test("binds to loopback and uses the documented defaults", () => {
    const config = readCompanionConfig({});
    expect(SERVER_HOSTNAME).toBe("127.0.0.1");
    expect(config.port).toBe(DEFAULT_SERVER_PORT);
    expect(config.chromeDebugPort).toBe(DEFAULT_CHROME_DEBUG_PORT);
    expect(config.allowedOrigins).toContain("http://localhost:3000");
  });

  test("appends extra origins without dropping the built-in ones", () => {
    const config = readCompanionConfig({
      BINJE_CAST_ORIGINS: "https://binje.duckdns.org, https://staging.example",
    });
    expect(config.allowedOrigins).toContain("https://staging.example");
    expect(config.allowedOrigins.filter((o) => o === "https://binje.duckdns.org")).toHaveLength(1);
  });

  test("refuses a port that is not a port", () => {
    expect(() => readCompanionConfig({ BINJE_CAST_PORT: "0" })).toThrow("Invalid BINJE_CAST_PORT");
    expect(() => readCompanionConfig({ BINJE_CAST_PORT: "http" })).toThrow(
      "Invalid BINJE_CAST_PORT",
    );
    expect(() => readCompanionConfig({ BINJE_CHROME_DEBUG_PORT: "99999" })).toThrow(
      "Invalid BINJE_CHROME_DEBUG_PORT",
    );
  });
});
