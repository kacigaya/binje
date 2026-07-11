import { afterEach, expect, mock, test } from "bun:test";
import { getRottenTomatoesScore } from "@/lib/rotten-tomatoes";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_API_KEY = process.env.OMDB_API_KEY;

function mockResponse(body: unknown, status = 200) {
  globalThis.fetch = mock(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.OMDB_API_KEY;
  } else {
    process.env.OMDB_API_KEY = ORIGINAL_API_KEY;
  }
});

test("returns Rotten Tomatoes score", async () => {
  process.env.OMDB_API_KEY = "test-key";
  mockResponse({ Ratings: [{ Source: "Rotten Tomatoes", Value: "87%" }] });

  expect(await getRottenTomatoesScore("tt1375666")).toBe(87);
});

test("skips requests without credentials or a valid IMDb ID", async () => {
  const fetchMock = mock(async () => new Response()) as unknown as typeof fetch;
  globalThis.fetch = fetchMock;

  delete process.env.OMDB_API_KEY;
  expect(await getRottenTomatoesScore("tt1375666")).toBeNull();

  process.env.OMDB_API_KEY = "test-key";
  expect(await getRottenTomatoesScore(null)).toBeNull();
  expect(await getRottenTomatoesScore("invalid")).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("rejects missing and malformed Rotten Tomatoes scores", async () => {
  process.env.OMDB_API_KEY = "test-key";
  mockResponse({ Ratings: [{ Source: "IMDb", Value: "8.7/10" }] });
  expect(await getRottenTomatoesScore("tt1375666")).toBeNull();

  mockResponse({ Ratings: [{ Source: "Rotten Tomatoes", Value: "101%" }] });
  expect(await getRottenTomatoesScore("tt1375666")).toBeNull();
});

test("returns null for provider failures", async () => {
  process.env.OMDB_API_KEY = "test-key";
  mockResponse({}, 503);
  expect(await getRottenTomatoesScore("tt1375666")).toBeNull();

  globalThis.fetch = mock(async () => {
    throw new Error("network failure");
  }) as unknown as typeof fetch;
  expect(await getRottenTomatoesScore("tt1375666")).toBeNull();
});
