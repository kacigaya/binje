import { describe, expect, test } from "bun:test";
import {
  isLibraryObject,
  objectUrl,
  presignGet,
  resolveFileUrl,
  storageConfigFromEnv,
  type StorageConfig,
} from "@/lib/storage";

const CONFIG: StorageConfig = {
  endpoint: "https://accountid.r2.cloudflarestorage.com",
  bucket: "binje",
  region: "auto",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  prefix: "",
  ttlSeconds: 900,
};

const AT = new Date("2026-07-26T12:00:00Z");

describe("storageConfigFromEnv", () => {
  test("returns null until every credential is present", () => {
    expect(storageConfigFromEnv({})).toBeNull();
    expect(
      storageConfigFromEnv({
        STORAGE_ENDPOINT: "https://x.example",
        STORAGE_BUCKET: "binje",
        STORAGE_ACCESS_KEY_ID: "key",
      }),
    ).toBeNull();
  });

  test("applies defaults and trims the endpoint", () => {
    expect(
      storageConfigFromEnv({
        STORAGE_ENDPOINT: "https://x.example/",
        STORAGE_BUCKET: "binje",
        STORAGE_ACCESS_KEY_ID: "key",
        STORAGE_SECRET_ACCESS_KEY: "secret",
        STORAGE_PREFIX: "/library/",
      }),
    ).toEqual({
      endpoint: "https://x.example",
      bucket: "binje",
      region: "auto",
      accessKeyId: "key",
      secretAccessKey: "secret",
      prefix: "library",
      ttlSeconds: 900,
    });
  });

  test("ignores a non-positive ttl", () => {
    const config = storageConfigFromEnv({
      STORAGE_ENDPOINT: "https://x.example",
      STORAGE_BUCKET: "binje",
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_SECRET_ACCESS_KEY: "secret",
      STORAGE_URL_TTL_SECONDS: "-5",
    });
    expect(config?.ttlSeconds).toBe(900);
  });
});

describe("presignGet", () => {
  // Known answer produced by an independent SigV4 implementation (node crypto).
  test("signs a GET with the documented SigV4 query form", async () => {
    const signed = await presignGet(
      CONFIG,
      objectUrl(CONFIG, "movies/37165/index.json"),
      AT,
    );
    const url = new URL(signed);

    expect(url.pathname).toBe("/binje/movies/37165/index.json");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toBe(
      "AKIAIOSFODNN7EXAMPLE/20260726/auto/s3/aws4_request",
    );
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260726T120000Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toBe(
      "2969485d2afd2b9b29e1c616f5b7370e3bc48c364707f82879b948808488cd09",
    );
  });

  test("a different secret yields a different signature", async () => {
    const other = { ...CONFIG, secretAccessKey: "another-secret" };
    const [a, b] = await Promise.all([
      presignGet(CONFIG, objectUrl(CONFIG, "movies/1/index.json"), AT),
      presignGet(other, objectUrl(other, "movies/1/index.json"), AT),
    ]);

    expect(new URL(a).searchParams.get("X-Amz-Signature")).not.toBe(
      new URL(b).searchParams.get("X-Amz-Signature"),
    );
  });

  test("escapes keys that need RFC 3986 encoding", async () => {
    const signed = await presignGet(
      CONFIG,
      objectUrl(CONFIG, "movies/a b(1)/index.json"),
      AT,
    );

    expect(signed).toContain("/binje/movies/a%20b%281%29/index.json?");
  });
});

describe("objectUrl", () => {
  test("nests keys under the configured prefix", () => {
    expect(objectUrl({ ...CONFIG, prefix: "library" }, "movies/1/720p.m3u8")).toBe(
      "https://accountid.r2.cloudflarestorage.com/binje/library/movies/1/720p.m3u8",
    );
  });

  test("passes absolute urls through untouched", () => {
    expect(resolveFileUrl(CONFIG, "https://cdn.example/a.m3u8")).toBe(
      "https://cdn.example/a.m3u8",
    );
    expect(resolveFileUrl(CONFIG, "movies/1/720p.m3u8")).toBe(
      "https://accountid.r2.cloudflarestorage.com/binje/movies/1/720p.m3u8",
    );
  });
});

describe("isLibraryObject", () => {
  const allow = (path: string, config: StorageConfig = CONFIG) =>
    isLibraryObject(config, new URL(`${CONFIG.endpoint}${path}`));

  test("accepts media objects in the bucket", () => {
    expect(allow("/binje/movies/37165/1080p.m3u8")).toBe(true);
    expect(allow("/binje/movies/37165/seg-001.ts")).toBe(true);
    expect(allow("/binje/movies/37165/subs/en.vtt")).toBe(true);
    expect(allow("/binje/movies/37165/index.json")).toBe(true);
  });

  test("refuses non-media keys", () => {
    expect(allow("/binje/backups/db.sql")).toBe(false);
    expect(allow("/binje/.env")).toBe(false);
    expect(allow("/binje/")).toBe(false);
  });

  test("refuses other buckets and hosts", () => {
    expect(allow("/private/movies/1/1080p.m3u8")).toBe(false);
    expect(
      isLibraryObject(CONFIG, new URL("https://evil.example/binje/a.m3u8")),
    ).toBe(false);
    expect(
      isLibraryObject(CONFIG, new URL("http://accountid.r2.cloudflarestorage.com/binje/a.m3u8")),
    ).toBe(false);
  });

  test("confines access to the configured prefix", () => {
    const scoped = { ...CONFIG, prefix: "library" };
    expect(allow("/binje/library/movies/1/1080p.m3u8", scoped)).toBe(true);
    expect(allow("/binje/other/movies/1/1080p.m3u8", scoped)).toBe(false);
  });

  // The URL parser collapses ".." and "%2e%2e" before the guard sees them, so
  // what matters is that traversal cannot land outside the bucket or prefix.
  test("traversal cannot escape the bucket", () => {
    expect(allow("/binje/movies/../../secret/a.m3u8")).toBe(false);
    expect(allow("/binje/movies/%2e%2e/%2e%2e/secret/a.m3u8")).toBe(false);
  });

  test("traversal cannot escape the prefix", () => {
    const scoped = { ...CONFIG, prefix: "library" };
    expect(allow("/binje/library/%2e%2e/movies/1/a.m3u8", scoped)).toBe(false);
    expect(allow("/binje/library/../movies/1/a.m3u8", scoped)).toBe(false);
  });
});
