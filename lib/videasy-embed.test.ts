import { describe, expect, test } from "bun:test";
import { parseVideasyEmbedProgress, videasyEmbedUrl } from "@/lib/videasy-embed";

const movie = { type: "movie" as const, id: 532671 };
const episode = { type: "tv" as const, id: 1399, season: 2, episode: 3 };

describe("videasyEmbedUrl", () => {
  test("builds movie and episode paths", () => {
    expect(videasyEmbedUrl(movie, null)).toBe("https://player.videasy.ws/embed/movie/532671?autoplay=1");
    expect(videasyEmbedUrl(episode, null)).toBe("https://player.videasy.ws/embed/tv/1399/2/3?autoplay=1");
  });

  test("resumes from whole seconds only when there is a position", () => {
    expect(videasyEmbedUrl(movie, 125.7)).toBe("https://player.videasy.ws/embed/movie/532671?autoplay=1&startAt=125");
    expect(videasyEmbedUrl(movie, 0)).not.toContain("startAt");
  });
});

describe("parseVideasyEmbedProgress", () => {
  const event = (data: Record<string, unknown>) => ({ type: "PLAYER_EVENT", data });

  test("reads progress from object and JSON string messages", () => {
    const message = event({ player_progress: 61, player_duration: 5520, player_info: { tmdb: 532671 } });
    expect(parseVideasyEmbedProgress(message, movie)).toEqual({ positionSeconds: 61, durationSeconds: 5520 });
    expect(parseVideasyEmbedProgress(JSON.stringify(message), movie)).toEqual({
      positionSeconds: 61,
      durationSeconds: 5520,
    });
  });

  test("ignores other titles and episodes", () => {
    expect(parseVideasyEmbedProgress(event({ player_progress: 1, player_duration: 2, player_info: { tmdb: 1 } }), movie)).toBeNull();
    expect(
      parseVideasyEmbedProgress(
        event({ player_progress: 1, player_duration: 2, player_info: { tmdb: 1399, season: 2, episode: 4 } }),
        episode,
      ),
    ).toBeNull();
  });

  test("rejects unrelated or malformed messages", () => {
    expect(parseVideasyEmbedProgress("not json", movie)).toBeNull();
    expect(parseVideasyEmbedProgress({ type: "OTHER", data: {} }, movie)).toBeNull();
    expect(parseVideasyEmbedProgress(event({ player_progress: "x", player_duration: 10 }), movie)).toBeNull();
  });
});
