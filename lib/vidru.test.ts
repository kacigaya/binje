import { describe, expect, test } from "bun:test";
import {
  decryptStreamUrls,
  pageConfig,
  parseHostToken,
  streamUrlsPayload,
  withHostToken,
} from "@/lib/vidru";

// alloc() -> 0 and decrypt(ptr, len) -> len - 12: an identity "cipher" with
// the provider's export shape, so the plaintext is the input after its nonce.
const IDENTITY_DECRYPTOR = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x0c, 0x02, 0x60, 0x01, 0x7f, 0x01, 0x7f, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
  0x03, 0x03, 0x02, 0x00, 0x01,
  0x05, 0x03, 0x01, 0x00, 0x01,
  0x07, 0x1c, 0x03,
  0x06, ...new TextEncoder().encode("memory"), 0x02, 0x00,
  0x05, ...new TextEncoder().encode("alloc"), 0x00, 0x00,
  0x07, ...new TextEncoder().encode("decrypt"), 0x00, 0x01,
  0x0a, 0x0e, 0x02,
  0x04, 0x00, 0x41, 0x00, 0x0b,
  0x07, 0x00, 0x20, 0x01, 0x41, 0x0c, 0x6b, 0x0b,
]);

describe("pageConfig", () => {
  test("reads an inline config line", () => {
    const html = `<script>window.CFG = {"playerUrl":"/embed/player/movie/1?vs=a","n":"};x"};</script>\n<script>var CFG = window.CFG || {};</script>`;
    expect(pageConfig(html, "CFG")).toEqual({ playerUrl: "/embed/player/movie/1?vs=a", n: "};x" });
    expect(pageConfig("window.CONFIG = {\"apiToken\":\"t\"};\n", "CONFIG")).toEqual({ apiToken: "t" });
  });

  test("returns undefined for a missing or broken config", () => {
    expect(pageConfig("<p>none</p>", "CFG")).toBeUndefined();
    expect(pageConfig("window.CFG = {broken};", "CFG")).toBeUndefined();
  });
});

describe("streamUrlsPayload", () => {
  test("keeps plain lists and drops non-http entries", () => {
    expect(
      streamUrlsPayload({ status_code: "200", data: { stream_urls: ["https://a.test/m.m3u8", "file:///etc/passwd"] } }),
    ).toEqual({ urls: ["https://a.test/m.m3u8"] });
  });

  test("hands encrypted lists to the decryptor", () => {
    expect(
      streamUrlsPayload({
        status_code: "200",
        data: { stream_urls: "c2VjcmV0" },
        vs: { w: 7, wasm_url: "https://data.test/wasm.php?w=7" },
      }),
    ).toEqual({ encrypted: "c2VjcmV0", wasmUrl: "https://data.test/wasm.php?w=7", window: "7" });
  });

  test("rejects errors and missing streams", () => {
    expect(() => streamUrlsPayload({ status_code: "403", error: "invalid api token" })).toThrow();
    expect(() => streamUrlsPayload({ status_code: "200", data: { stream_urls: "x" } })).toThrow();
  });
});

describe("decryptStreamUrls", () => {
  const decryptModule = new WebAssembly.Module(IDENTITY_DECRYPTOR);

  test("reads the plaintext after the nonce and keeps http URLs", async () => {
    const plain = "https://a.test/1/master.m3u8\njavascript:alert(1)\nhttps://b.test/2/master.m3u8\n";
    const input = Buffer.concat([Buffer.alloc(12), Buffer.from(plain)]).toString("base64");
    expect(await decryptStreamUrls(decryptModule, input)).toEqual([
      "https://a.test/1/master.m3u8",
      "https://b.test/2/master.m3u8",
    ]);
  });

  test("rejects a payload shorter than its nonce", async () => {
    await expect(decryptStreamUrls(decryptModule, Buffer.alloc(4).toString("base64"))).rejects.toThrow();
  });

  test("stops a decryptor that never returns", async () => {
    // Same module with decrypt's body replaced by `loop br 0 end unreachable`.
    const looping = new Uint8Array([
      ...IDENTITY_DECRYPTOR.subarray(0, IDENTITY_DECRYPTOR.length - 16),
      0x0a, 0x0f, 0x02,
      0x04, 0x00, 0x41, 0x00, 0x0b,
      0x08, 0x00, 0x03, 0x40, 0x0c, 0x00, 0x0b, 0x00, 0x0b,
    ]);
    const input = Buffer.alloc(20).toString("base64");
    await expect(decryptStreamUrls(new WebAssembly.Module(looping), input)).rejects.toThrow("timed out");
  });
});

describe("host tokens", () => {
  test("parses text and JSON answers, rejecting unsafe values", () => {
    expect(parseHostToken(" eyJ.a-b_c \n")).toBe("eyJ.a-b_c");
    expect(parseHostToken('{"token":"abc.def"}')).toBe("abc.def");
    expect(parseHostToken('"abc"')).toBe("abc");
    expect(parseHostToken("<html>429</html>")).toBeUndefined();
    expect(parseHostToken("a&b=c")).toBeUndefined();
  });

  test("stamps the placeholder or the token query", () => {
    expect(withHostToken("https://a.test/pl/x/master.m3u8", "t1")).toBe("https://a.test/pl/x/master.m3u8?token=t1");
    expect(withHostToken("https://a.test/__TOKEN__/master.m3u8", "t1")).toBe("https://a.test/t1/master.m3u8");
  });
});
